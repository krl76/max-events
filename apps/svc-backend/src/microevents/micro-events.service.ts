// START_MODULE_CONTRACT
// PURPOSE: UGC micro-events — minimal create, author auto-joins, capacity-locked join/leave, published immediately.
// SCOPE: list/create/join/leave; every DTO carries its participantIds; unpublished rows are hidden from the public list.
// DEPENDS: typeorm, @max-events/api-contracts, places/users
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MicroEventsService - create/list/join/leave
// - toMicroEventDto - entity plus its participant ids to the MicroEvent contract
// END_MODULE_MAP

import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, OnModuleInit, Optional, ServiceUnavailableException } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { MicroEventSchema, type CreateMicroEventWrite, type CreatePlanExpenseWrite, type Friend, type MicroBudget, type MicroEvent, type Place } from "@max-events/api-contracts";
import { toFriendDto } from "../friends/friends.service";
import { MaxBotClient } from "../max-bot/max-bot.client";
import { PlaceEntity } from "../places/place.entity";
import { toPlaceDto } from "../places/places.service";
import { PlanExpenseEntity } from "../plans/plan-expense.entity";
import { budgetFromExpenses } from "../plans/plans.service";
import { deliverInvite, INVITE_REPLY_ACTIONS } from "../smart-alerts/deliver-invite";
import { humanWhen, miniappLink, withAppLink } from "../time/human-when";
import { NotificationEntity } from "../smart-alerts/notification.entity";
import { UserEntity } from "../users/user.entity";
import { UsersService } from "../users/users.service";
import { MicroEventExpenseEntity } from "./micro-event-expense.entity";
import { MicroEventEntity, MicroEventParticipantEntity } from "./micro-event.entity";

/** Plan split, rewritten so each line names the micro-event instead of a plan. */
export function microBudgetFromRows(rows: MicroEventExpenseEntity[], party: Iterable<string>): MicroBudget {
  const budget = budgetFromExpenses(
    rows.map((row) => ({ ...row, planId: row.microEventId }) as PlanExpenseEntity),
    party,
  );
  return {
    expenses: budget.expenses.map((expense) => ({
      id: expense.id,
      microEventId: expense.planId,
      title: expense.title,
      amountRub: expense.amountRub,
      payerUserId: expense.payerUserId,
      shareUserIds: expense.shareUserIds,
      createdAt: expense.createdAt,
    })),
    perPerson: budget.perPerson,
    debts: budget.debts,
    totalRub: budget.totalRub,
  };
}

/** Shown on the home feed when production has no open micro-events yet, so the block can be judged. */
export const SHOWCASE_MICRO_EVENTS: ReadonlyArray<{ title: string; where: string; days: number; hour: number; limit: number }> = [
  { title: "Утренняя пробежка в Лужниках", where: "Лужники", days: 1, hour: 9, limit: 12 },
  { title: "Настолки в кофейне", where: "Патриаршие", days: 2, hour: 19, limit: 6 },
  { title: "Вечерний волейбол", where: "Парк Горького", days: 3, hour: 18, limit: 10 },
  { title: "Прогулка по набережной", where: "Крымская набережная", days: 1, hour: 20, limit: 8 },
  { title: "Завтрак и выставка", where: "Третьяковская галерея", days: 4, hour: 11, limit: 5 },
  { title: "Субботник у пруда", where: "Чистые пруды", days: 5, hour: 12, limit: 15 },
];

@Injectable()
export class MicroEventsService implements OnModuleInit {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(MicroEventEntity) private readonly events: Repository<MicroEventEntity>,
    @InjectRepository(MicroEventParticipantEntity) private readonly participants: Repository<MicroEventParticipantEntity>,
    @InjectRepository(PlaceEntity) private readonly places: Repository<PlaceEntity>,
    @Inject(UsersService) private readonly users: UsersService,
    @Optional() @Inject(MaxBotClient) private readonly bot?: MaxBotClient,
    @Optional() @InjectRepository(NotificationEntity) private readonly notices?: Repository<NotificationEntity>,
    @Optional() @InjectRepository(MicroEventExpenseEntity) private readonly expenses?: Repository<MicroEventExpenseEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const open = await this.events.count({ where: { published: true, status: "open" } });
      if (open > 0) return;
      const [author] = await this.dataSource.getRepository(UserEntity).find({ take: 1, order: { createdAt: "ASC" } });
      if (!author) return;
      const now = new Date();
      for (const item of SHOWCASE_MICRO_EVENTS) {
        const startsAt = new Date(now.getTime() + item.days * 24 * 60 * 60 * 1000);
        startsAt.setHours(item.hour, 0, 0, 0);
        await this.events.save(this.events.create({ authorId: author.id, title: item.title, startsAt, locationText: item.where, placeId: null, description: "", listed: true, participantsLimit: item.limit, status: "open", published: true }));
      }
    } catch {
      // A database that is still migrating must boot. The home block stays empty until the next start.
    }
  }

  async getCard(id: string): Promise<{ event: MicroEvent; place: Place | null; participants: Array<{ friend: Friend; author: boolean }> }> {
    const row = await this.events.findOneBy({ id });
    if (!row || !row.published) throw new NotFoundException("Micro-event not found");
    const event = await this.toDto(row);
    const place = row.placeId ? await this.places.findOneBy({ id: row.placeId }) : null;
    return {
      event,
      place: place ? toPlaceDto(place) : null,
      participants: event.participants.map((friend) => ({ friend, author: friend.id === event.authorId })),
    };
  }

  async list(): Promise<MicroEvent[]> {
    const rows = (await this.events.find({ where: { published: true, listed: true, status: "open" } })).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    if (rows.length === 0) return [];
    // One batch for the whole page instead of a participant query per row.
    const participants = await this.participants.find({ where: { microEventId: In(rows.map((row) => row.id)) } });
    const byEvent = new Map<string, string[]>();
    for (const row of participants) byEvent.set(row.microEventId, [...(byEvent.get(row.microEventId) ?? []), row.userId]);
    const friends = await this.friendsOf([...new Set(participants.map((row) => row.userId))]);
    return rows.map((row) => toMicroEventDto(row, byEvent.get(row.id) ?? [], friends));
  }

  async create(userId: string, payload: CreateMicroEventWrite): Promise<MicroEvent> {
    await this.users.assertCanPublish(userId);
    if (payload.placeId) {
      const place = await this.places.findOneBy({ id: payload.placeId });
      if (!place) throw new NotFoundException("Place not found");
    }
    const saved = await this.events.save(
      this.events.create({
        authorId: userId,
        title: payload.title,
        startsAt: new Date(payload.startsAt),
        locationText: payload.locationText ?? null,
        placeId: payload.placeId ?? null,
        description: payload.description?.trim() ?? "",
        listed: payload.listed ?? true,
        participantsLimit: payload.participantsLimit ?? null,
        status: "open",
        published: true,
      }),
    );
    await this.participants.save(this.participants.create({ microEventId: saved.id, userId }));
    const invitees = (payload.inviteeIds ?? []).filter((id) => id !== userId);
    if (invitees.length > 0 && this.bot) {
      const people = await this.users.findByIds(invitees);
      for (const person of people) {
        const where = saved.locationText ?? "Точка на карте";
        const text = withAppLink(`Тебя зовут на микро-событие «${saved.title}». ${humanWhen(saved.startsAt)}, ${where}.`, miniappLink(`micro-${saved.id}`));
        try {
          await deliverInvite(this.bot, this.notices, { userId: person.id, maxUserId: person.maxUserId, actorUserId: userId, type: "micro-invite", title: `Микро-событие «${saved.title}»`, body: text, link: { target: "micro", id: saved.id }, actions: INVITE_REPLY_ACTIONS });
        } catch {
          // An invite that fails to leave the process still leaves the event itself published.
        }
      }
    }
    return this.toDto(saved);
  }

  async getBudget(actorId: string, id: string): Promise<MicroBudget> {
    const event = await this.requirePublished(id);
    const party = await this.partyIds(id);
    if (!party.has(actorId)) throw new ForbiddenException("Cannot view this gathering's budget");
    const rows = this.expenses ? await this.expenses.find({ where: { microEventId: event.id } }) : [];
    return microBudgetFromRows(rows, party);
  }

  async addExpense(actorId: string, id: string, payload: CreatePlanExpenseWrite): Promise<MicroBudget> {
    if (!this.expenses) throw new ServiceUnavailableException("Budget is unavailable");
    const event = await this.requirePublished(id);
    const party = await this.partyIds(id);
    if (!party.has(actorId)) throw new ForbiddenException("Cannot edit this gathering's budget");
    if (event.authorId !== actorId && payload.payerUserId !== actorId) {
      throw new ForbiddenException("Cannot attribute a payment to another person");
    }
    if (!party.has(payload.payerUserId) || payload.shareUserIds.some((userId) => !party.has(userId))) {
      throw new BadRequestException("Invalid expense payload");
    }
    await this.expenses.save(
      this.expenses.create({
        microEventId: event.id,
        title: payload.title.trim(),
        amountRub: payload.amountRub,
        payerUserId: payload.payerUserId,
        shareUserIds: [...new Set(payload.shareUserIds)],
      }),
    );
    return this.getBudget(actorId, id);
  }

  async join(userId: string, id: string): Promise<MicroEvent> {
    return this.dataSource.transaction(async (manager) => {
      const event = await manager.findOne(MicroEventEntity, { where: { id }, lock: { mode: "pessimistic_write" } });
      if (!event || !event.published || event.status !== "open") throw new NotFoundException("Micro-event not found");
      const taken = await manager.find(MicroEventParticipantEntity, { where: { microEventId: id } });
      const ids = taken.map((row) => row.userId);
      if (ids.includes(userId)) return toMicroEventDto(event, ids, await this.friendsOf(ids));
      if (event.participantsLimit !== null && ids.length >= event.participantsLimit) throw new ConflictException("No seats left");
      await manager.save(MicroEventParticipantEntity, manager.create(MicroEventParticipantEntity, { microEventId: id, userId }));
      const next = [...ids, userId];
      return toMicroEventDto(event, next, await this.friendsOf(next));
    });
  }

  async leave(userId: string, id: string): Promise<MicroEvent> {
    const event = await this.events.findOneBy({ id });
    if (!event) throw new NotFoundException("Micro-event not found");
    const existing = await this.participants.findOneBy({ microEventId: id, userId });
    if (!existing) throw new ForbiddenException("Not a participant");
    await this.participants.delete({ id: existing.id });
    return this.toDto(event);
  }

  async unpublish(id: string): Promise<void> {
    const event = await this.events.findOneBy({ id });
    if (!event) throw new NotFoundException("Micro-event not found");
    event.published = false;
    await this.events.save(event);
  }

  private async requirePublished(id: string): Promise<MicroEventEntity> {
    const event = await this.events.findOneBy({ id });
    if (!event || !event.published) throw new NotFoundException("Micro-event not found");
    return event;
  }

  private async partyIds(id: string): Promise<Set<string>> {
    const rows = await this.participants.find({ where: { microEventId: id } });
    return new Set(rows.map((row) => row.userId));
  }

  private async toDto(row: MicroEventEntity): Promise<MicroEvent> {
    const participants = await this.participants.find({ where: { microEventId: row.id } });
    const ids = participants.map((item) => item.userId);
    return toMicroEventDto(row, ids, await this.friendsOf(ids));
  }

  private async friendsOf(ids: string[]): Promise<Friend[]> {
    const users = await this.users.findByIds(ids);
    return users.map(toFriendDto);
  }
}

export function toMicroEventDto(row: MicroEventEntity, participantIds: string[], friends: Friend[] = []): MicroEvent {
  const ids = [...participantIds].sort();
  const byId = new Map(friends.map((friend) => [friend.id, friend]));
  return MicroEventSchema.parse({
    id: row.id,
    authorId: row.authorId,
    title: row.title,
    startsAt: row.startsAt.toISOString(),
    locationText: row.locationText,
    placeId: row.placeId,
    description: row.description ?? "",
    listed: row.listed ?? true,
    participantsLimit: row.participantsLimit,
    participantsCount: ids.length,
    participantIds: ids,
    participants: ids.flatMap((id) => {
      const friend = byId.get(id);
      return friend ? [friend] : [];
    }),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  });
}
