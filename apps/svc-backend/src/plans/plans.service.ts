// START_MODULE_CONTRACT
// PURPOSE: Event-tied plans — create/list/get, invite/confirm, MAX chat, recurring spawn/poll, meeting-time reminders.
// SCOPE: PlanCard with distance to event place when origin is set; chat/DM best-effort; declined users skipped on remind/poll.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, events/friends/places/users/max-bot, reminders window helper
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - GeoOrigin - lat/lng origin for distance
// - PlanRemindResult - sent/failed counts
// - haversineMeters - distance from origin to a lat/lng
// - formatPlanReminderText - DM body for the meeting
// - formatPlanInviteText - invite DM body
// - formatPlanPollText - recurring occurrence poll DM body
// - PLAN_POLL_WINDOW_MS - look-ahead window for occurrence polls
// - settleBalances - greedy debt settlement
// - budgetFromExpenses - split expenses into per-person nets and debts
// - PlansService - create, list, get, addParticipant, respond, remove, spawnRecurring, pollRecurring, remindMeeting, budget
// END_MODULE_MAP

import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository } from "typeorm";
import type { AutoPlanProposal, CreatePlanExpenseWrite, CreatePlanWrite, Plan, PlanBudget, PlanCard, PlanDebt, PlanParticipantStatus, Place } from "@max-events/api-contracts";
import { toEventDto } from "../events/events.service";
import { EventEntity } from "../events/event.entity";
import { FriendsService, toFriendDto } from "../friends/friends.service";
import { MaxBotClient } from "../max-bot/max-bot.client";
import { PlaceEntity } from "../places/place.entity";
import { toPlaceDto } from "../places/places.service";
import { isInReminderWindow } from "../reminders/reminders.service";
import { UserEntity } from "../users/user.entity";
import { PlanExpenseEntity } from "./plan-expense.entity";
import { PlanParticipantEntity } from "./plan-participant.entity";
import { PlanEntity } from "./plan.entity";
import { moscowIsoWeekday, upcomingRecurringAts } from "./recurring";

export type GeoOrigin = { latitude: number; longitude: number };
export type PlanRemindResult = { sent: number; failed: number };

const WALK_M_PER_MIN = 80;
const FOOD_RADIUS_KM = 2;
const MEETUP_BUFFER_MIN = 20;
const DINNER_MIN = 70;
export const PLAN_POLL_WINDOW_MS = 7 * 86_400_000;

const WEEKDAY_POLL: Record<number, string> = {
  1: "понедельник",
  2: "вторник",
  3: "среду",
  4: "четверг",
  5: "пятницу",
  6: "субботу",
  7: "воскресенье",
};

export function haversineMeters(from: GeoOrigin, latitude: number, longitude: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earth = 6_371_000;
  const dLat = toRad(latitude - from.latitude);
  const dLon = toRad(longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.latitude)) * Math.cos(toRad(latitude)) * Math.sin(dLon / 2) ** 2;
  const meters = 2 * earth * Math.asin(Math.min(1, Math.sqrt(a)));
  return Math.max(0, Math.round(meters));
}

export function formatPlanReminderText(title: string, meetingPoint: string, meetingAt: Date): string {
  return `Напоминание: сбор «${title}» ${meetingPoint} в ${meetingAt.toISOString()}`;
}

export function settleBalances(balances: Map<string, number>): PlanDebt[] {
  const debtors = [...balances.entries()].filter(([, value]) => value < 0).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  const creditors = [...balances.entries()].filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const debts: PlanDebt[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(-debtors[i]![1], creditors[j]![1]);
    if (pay > 0) debts.push({ fromUserId: debtors[i]![0], toUserId: creditors[j]![0], amountRub: pay });
    debtors[i]![1] += pay;
    creditors[j]![1] -= pay;
    if (debtors[i]![1] === 0) i += 1;
    if (creditors[j]![1] === 0) j += 1;
  }
  return debts;
}

export function budgetFromExpenses(rows: PlanExpenseEntity[], extraParty: Iterable<string> = []): PlanBudget {
  const ordered = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  const party = new Set(extraParty);
  for (const row of ordered) {
    party.add(row.payerUserId);
    for (const id of row.shareUserIds) party.add(id);
  }
  const people = [...party].sort();
  const paid = new Map(people.map((id) => [id, 0]));
  const share = new Map(people.map((id) => [id, 0]));
  for (const row of ordered) {
    paid.set(row.payerUserId, (paid.get(row.payerUserId) ?? 0) + row.amountRub);
    const ids = [...new Set(row.shareUserIds)].sort();
    if (ids.length === 0) continue;
    const n = ids.length;
    const base = Math.floor(row.amountRub / n);
    const rem = row.amountRub % n;
    const offset = [...row.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % n;
    ids.forEach((id, index) => {
      const extra = rem > 0 && (index - offset + n) % n < rem ? 1 : 0;
      share.set(id, (share.get(id) ?? 0) + base + extra);
    });
  }
  const balances = new Map(people.map((id) => [id, (paid.get(id) ?? 0) - (share.get(id) ?? 0)]));
  return {
    expenses: ordered.map(toExpenseDto),
    perPerson: people.map((userId) => ({
      userId,
      paidRub: paid.get(userId) ?? 0,
      shareRub: share.get(userId) ?? 0,
      netRub: balances.get(userId) ?? 0,
    })),
    debts: settleBalances(balances),
    totalRub: ordered.reduce((sum, row) => sum + row.amountRub, 0),
  };
}

function toExpenseDto(row: PlanExpenseEntity) {
  return {
    id: row.id,
    planId: row.planId,
    title: row.title,
    amountRub: row.amountRub,
    payerUserId: row.payerUserId,
    shareUserIds: row.shareUserIds,
    createdAt: row.createdAt.toISOString(),
  };
}

export function formatPlanInviteText(title: string, meetingPoint: string, meetingAt: Date, chatLink: string | null): string {
  const chat = chatLink ? ` Чат: ${chatLink}` : "";
  return `Тебя зовут в план «${title}». Сбор ${meetingAt.toISOString()} ${meetingPoint}.${chat}`;
}

export function formatPlanPollText(title: string, meetingPoint: string, meetingAt: Date): string {
  const weekday = WEEKDAY_POLL[moscowIsoWeekday(meetingAt)] ?? "встречу";
  return `Идёшь на ${weekday}? План «${title}». Сбор ${meetingAt.toISOString()} ${meetingPoint}. Ответь в приложении.`;
}

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(
    @InjectRepository(PlanEntity) private readonly plans: Repository<PlanEntity>,
    @InjectRepository(PlanParticipantEntity) private readonly participants: Repository<PlanParticipantEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(PlaceEntity) private readonly places: Repository<PlaceEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(PlanExpenseEntity) private readonly expenses: Repository<PlanExpenseEntity>,
    @Inject(FriendsService) private readonly friends: FriendsService,
    @Inject(MaxBotClient) private readonly bot: MaxBotClient,
  ) {}

  async create(hostUserId: string, payload: CreatePlanWrite, origin: GeoOrigin | null = null): Promise<PlanCard> {
    const event = await this.events.findOneBy({ id: payload.eventId });
    if (!event) throw new NotFoundException("Event not found");
    const ids = [...new Set(payload.participantIds)];
    if (ids.includes(hostUserId)) throw new BadRequestException("Invalid plan payload");
    const allowed = await this.friends.friendIds(hostUserId);
    if (ids.some((id) => !allowed.has(id))) throw new BadRequestException("Invalid plan payload");
    const saved = await this.plans.save(
      this.plans.create({
        hostUserId,
        eventId: event.id,
        meetingPoint: payload.meetingPoint,
        meetingAt: new Date(payload.meetingAt),
        chatLink: null,
        reminderSentAt: null,
        leaveNowSentAt: null,
        weatherAlertSentAt: null,
        friendLeftBroadcastAt: null,
        recurringRule: payload.recurringRule ?? null,
        seriesId: null,
        sourcePlanId: null,
        cancelledAt: null,
      }),
    );
    if (payload.recurringRule) {
      saved.seriesId = saved.id;
      await this.plans.save(saved);
    }
    for (const userId of ids) {
      await this.participants.save(this.participants.create({ planId: saved.id, userId, status: "invited", reminderSentAt: null, leaveNowSentAt: null, friendLeftBroadcastAt: null, pollSentAt: null }));
    }
    try {
      const chat = await this.bot.createChat(`План: ${event.title}`);
      if (chat) {
        saved.chatLink = chat.link;
        await this.plans.save(saved);
      }
    } catch {
      this.logger.warn(`Plan chat create failed for ${saved.id}`);
    }
    const users = await this.users.find();
    for (const userId of ids) {
      const user = users.find((row) => row.id === userId);
      if (!user) continue;
      try {
        await this.bot.sendMessage(user.maxUserId, formatPlanInviteText(event.title, saved.meetingPoint, saved.meetingAt, saved.chatLink));
      } catch {
        this.logger.warn(`Plan invite DM failed for ${saved.id}`);
      }
    }
    if (payload.recurringRule) await this.spawnRecurring(saved.meetingAt);
    return this.toCard(saved, event, origin);
  }

  async spawnRecurring(now = new Date()): Promise<number> {
    const all = await this.plans.find();
    const templates = all.filter((row) => row.recurringRule && row.seriesId && !row.cancelledAt);
    let created = 0;
    for (const template of templates) {
      try {
        created += await this.spawnSeries(template, all, now);
      } catch (error) {
        this.logger.error(`Plan spawn failed for series ${template.seriesId}`, error instanceof Error ? error.stack : String(error));
      }
    }
    return created;
  }

  private async spawnSeries(template: PlanEntity, all: PlanEntity[], now: Date): Promise<number> {
    const existing = new Set(all.filter((row) => row.seriesId === template.seriesId).map((row) => row.meetingAt.getTime()));
    const times = upcomingRecurringAts(template.meetingAt, template.recurringRule!, now, 4);
    const invitees = (await this.participants.find({ where: { planId: template.id } })).filter((row) => row.status !== "declined");
    let created = 0;
    for (const meetingAt of times) {
      if (existing.has(meetingAt.getTime())) continue;
      let copy: PlanEntity | undefined;
      try {
        copy = await this.plans.save(
          this.plans.create({
            hostUserId: template.hostUserId,
            eventId: template.eventId,
            meetingPoint: template.meetingPoint,
            meetingAt,
            chatLink: null,
            reminderSentAt: null,
            leaveNowSentAt: null,
            weatherAlertSentAt: null,
            friendLeftBroadcastAt: null,
            recurringRule: null,
            seriesId: template.seriesId,
            sourcePlanId: template.id,
            cancelledAt: null,
          }),
        );
        for (const row of invitees) {
          await this.participants.save(this.participants.create({ planId: copy.id, userId: row.userId, status: "invited", reminderSentAt: null, leaveNowSentAt: null, friendLeftBroadcastAt: null, pollSentAt: null }));
        }
        existing.add(meetingAt.getTime());
        created += 1;
        all.push(copy);
      } catch (error) {
        if (isUniqueViolation(error)) {
          existing.add(meetingAt.getTime());
          continue;
        }
        if (copy) {
          const rows = await this.participants.find({ where: { planId: copy.id } });
          for (const row of rows) await this.participants.delete({ id: row.id });
          await this.plans.delete({ id: copy.id });
        }
        this.logger.error(`Plan spawn failed for series ${template.seriesId} at ${meetingAt.toISOString()}`, error instanceof Error ? error.stack : String(error));
      }
    }
    return created;
  }

  async generateAutoplan(hostUserId: string, eventId: string, origin: GeoOrigin): Promise<AutoPlanProposal> {
    const event = await this.events.findOneBy({ id: eventId });
    if (!event) throw new NotFoundException("Event not found");
    const venue = event.placeId ? await this.places.findOneBy({ id: event.placeId }) : null;
    const meters = venue ? haversineMeters(origin, venue.latitude, venue.longitude) : 0;
    const travelMinutes = Math.max(0, Math.round(meters / WALK_M_PER_MIN));
    const foodPlaces: Place[] = [];
    if (venue) {
      const all = await this.places.find({ where: { published: true, category: "food" } });
      const ranked = all
        .map((place) => ({ place, km: haversineMeters({ latitude: venue.latitude, longitude: venue.longitude }, place.latitude, place.longitude) / 1000 }))
        .filter((row) => row.km <= FOOD_RADIUS_KM)
        .sort((a, b) => a.km - b.km)
        .slice(0, 3);
      for (const row of ranked) foodPlaces.push(toPlaceDto(row.place));
    }
    const meetupAt = new Date(event.startsAt.getTime() - (travelMinutes + MEETUP_BUFFER_MIN) * 60_000);
    const dinnerAt = new Date(meetupAt.getTime() - DINNER_MIN * 60_000);
    const meetingPoint = foodPlaces[0]?.title ?? venue?.address ?? event.city;
    const card = await this.create(hostUserId, { eventId, participantIds: [], meetingPoint, meetingAt: meetupAt.toISOString() }, origin);
    const timeline = [];
    if (foodPlaces[0]) timeline.push({ at: dinnerAt.toISOString(), label: "ужин", detail: foodPlaces[0].title });
    timeline.push({ at: new Date(dinnerAt.getTime() + DINNER_MIN * 60_000).toISOString(), label: "дорога", detail: `${travelMinutes} мин до места` });
    timeline.push({ at: meetupAt.toISOString(), label: "встреча", detail: meetingPoint });
    timeline.push({ at: event.startsAt.toISOString(), label: "событие", detail: event.title });
    return { plan: card, travelMinutes, foodPlaces, timeline };
  }

  async list(userId: string, origin: GeoOrigin | null = null): Promise<PlanCard[]> {
    const all = await this.plans.find();
    const mine = [];
    for (const plan of all) {
      if (plan.cancelledAt) continue;
      if (await this.canView(userId, plan)) mine.push(plan);
    }
    mine.sort((a, b) => a.meetingAt.getTime() - b.meetingAt.getTime() || a.id.localeCompare(b.id));
    const cards: PlanCard[] = [];
    for (const plan of mine) {
      const event = await this.events.findOneBy({ id: plan.eventId });
      if (!event) continue;
      cards.push(await this.toCard(plan, event, origin));
    }
    return cards;
  }

  async get(userId: string, planId: string, origin: GeoOrigin | null = null): Promise<PlanCard> {
    const plan = await this.requireActivePlan(planId);
    if (!(await this.canView(userId, plan))) throw new ForbiddenException("Cannot view another user's plan");
    const event = await this.events.findOneBy({ id: plan.eventId });
    if (!event) throw new NotFoundException("Event not found");
    return this.toCard(plan, event, origin);
  }

  async addParticipant(hostUserId: string, planId: string, userId: string): Promise<PlanCard> {
    const plan = await this.requireActivePlan(planId);
    if (plan.hostUserId !== hostUserId) throw new ForbiddenException("Cannot edit another user's plan");
    if (userId === hostUserId) throw new BadRequestException("Invalid plan payload");
    const allowed = await this.friends.friendIds(hostUserId);
    if (!allowed.has(userId)) throw new BadRequestException("Invalid plan payload");
    const existing = (await this.participants.find({ where: { planId } })).find((row) => row.userId === userId);
    if (!existing) {
      await this.participants.save(this.participants.create({ planId, userId, status: "invited", reminderSentAt: null, leaveNowSentAt: null, friendLeftBroadcastAt: null, pollSentAt: null }));
    }
    return this.get(hostUserId, planId);
  }

  async respond(userId: string, planId: string, status: "confirmed" | "declined"): Promise<PlanCard> {
    await this.requireActivePlan(planId);
    const row = (await this.participants.find({ where: { planId } })).find((item) => item.userId === userId);
    if (!row) throw new ForbiddenException("Cannot respond to this plan");
    row.status = status;
    await this.participants.save(row);
    return this.get(userId, planId);
  }

  async remove(hostUserId: string, planId: string): Promise<void> {
    const plan = await this.requireActivePlan(planId);
    if (plan.hostUserId !== hostUserId) throw new ForbiddenException("Cannot delete another user's plan");
    if (plan.seriesId) {
      plan.cancelledAt = new Date();
      await this.plans.save(plan);
      return;
    }
    const rows = await this.participants.find({ where: { planId } });
    for (const row of rows) await this.participants.delete({ id: row.id });
    await this.plans.delete({ id: planId });
  }

  async pollRecurring(now = new Date()): Promise<PlanRemindResult> {
    const result: PlanRemindResult = { sent: 0, failed: 0 };
    const plans = await this.plans.find();
    const events = await this.events.find();
    const users = await this.users.find();
    const participants = await this.participants.find();
    for (const plan of plans) {
      if (plan.cancelledAt || !plan.sourcePlanId) continue;
      if (!isInReminderWindow(plan.meetingAt, now, PLAN_POLL_WINDOW_MS)) continue;
      const event = events.find((row) => row.id === plan.eventId);
      if (!event) continue;
      const text = formatPlanPollText(event.title, plan.meetingPoint, plan.meetingAt);
      for (const row of participants.filter((item) => item.planId === plan.id)) {
        if (row.status !== "invited" || row.pollSentAt) continue;
        const user = users.find((item) => item.id === row.userId);
        if (!user) {
          result.failed += 1;
          continue;
        }
        const sent = await this.dm(user, text, () => {
          row.pollSentAt = now;
          return this.participants.save(row);
        });
        if (sent) result.sent += 1;
        else result.failed += 1;
      }
    }
    return result;
  }

  async remindMeeting(now = new Date()): Promise<PlanRemindResult> {
    const result: PlanRemindResult = { sent: 0, failed: 0 };
    const plans = await this.plans.find();
    const events = await this.events.find();
    const users = await this.users.find();
    const participants = await this.participants.find();
    for (const plan of plans) {
      if (plan.cancelledAt) continue;
      if (!isInReminderWindow(plan.meetingAt, now)) continue;
      const event = events.find((row) => row.id === plan.eventId);
      if (!event) continue;
      const text = formatPlanReminderText(event.title, plan.meetingPoint, plan.meetingAt);
      const host = users.find((row) => row.id === plan.hostUserId);
      if (host && !plan.reminderSentAt) {
        const sent = await this.dm(host, text, () => {
          plan.reminderSentAt = now;
          return this.plans.save(plan);
        });
        if (sent) result.sent += 1;
        else result.failed += 1;
      }
      for (const row of participants.filter((item) => item.planId === plan.id)) {
        if (row.status === "declined" || row.reminderSentAt) continue;
        const user = users.find((item) => item.id === row.userId);
        if (!user) {
          result.failed += 1;
          continue;
        }
        const sent = await this.dm(user, text, () => {
          row.reminderSentAt = now;
          return this.participants.save(row);
        });
        if (sent) result.sent += 1;
        else result.failed += 1;
      }
    }
    return result;
  }

  private async dm(user: UserEntity, text: string, mark: () => Promise<unknown>): Promise<boolean> {
    let ok = false;
    try {
      ok = await this.bot.sendMessage(user.maxUserId, text);
    } catch {
      ok = false;
    }
    if (!ok) {
      this.logger.warn(`Plan reminder failed for user ${user.id}`);
      return false;
    }
    await mark();
    return true;
  }

  async addExpense(actorId: string, planId: string, payload: CreatePlanExpenseWrite): Promise<PlanBudget> {
    const plan = await this.requireActivePlan(planId);
    if (!(await this.canSpend(actorId, plan))) throw new ForbiddenException("Cannot edit this plan's budget");
    const party = await this.spendPartyIds(plan);
    if (plan.hostUserId !== actorId && payload.payerUserId !== actorId) {
      throw new ForbiddenException("Cannot attribute a payment to another person");
    }
    if (!party.has(payload.payerUserId) || payload.shareUserIds.some((id) => !party.has(id))) {
      throw new BadRequestException("Invalid expense payload");
    }
    const shareUserIds = [...new Set(payload.shareUserIds)];
    await this.expenses.save(
      this.expenses.create({
        planId,
        title: payload.title.trim(),
        amountRub: payload.amountRub,
        payerUserId: payload.payerUserId,
        shareUserIds,
      }),
    );
    return this.getBudget(actorId, planId);
  }

  async getBudget(actorId: string, planId: string): Promise<PlanBudget> {
    const plan = await this.requireActivePlan(planId);
    if (!(await this.canView(actorId, plan))) throw new ForbiddenException("Cannot view another user's plan");
    const rows = await this.expenses.find({ where: { planId }, order: { createdAt: "ASC", id: "ASC" } });
    return budgetFromExpenses(rows, await this.spendPartyIds(plan));
  }

  private async requireActivePlan(planId: string): Promise<PlanEntity> {
    const plan = await this.plans.findOneBy({ id: planId });
    if (!plan || plan.cancelledAt) throw new NotFoundException("Plan not found");
    return plan;
  }

  private async spendPartyIds(plan: PlanEntity): Promise<Set<string>> {
    const rows = await this.participants.find({ where: { planId: plan.id } });
    const confirmed = rows.filter((row) => row.status === "confirmed").map((row) => row.userId);
    return new Set([plan.hostUserId, ...confirmed]);
  }

  private async canSpend(userId: string, plan: PlanEntity): Promise<boolean> {
    if (plan.hostUserId === userId) return true;
    const rows = await this.participants.find({ where: { planId: plan.id } });
    return rows.some((row) => row.userId === userId && row.status === "confirmed");
  }

  private async canView(userId: string, plan: PlanEntity): Promise<boolean> {
    if (plan.hostUserId === userId) return true;
    const rows = await this.participants.find({ where: { planId: plan.id } });
    return rows.some((row) => row.userId === userId);
  }

  private async toCard(plan: PlanEntity, event: EventEntity, origin: GeoOrigin | null): Promise<PlanCard> {
    const rows = await this.participants.find({ where: { planId: plan.id } });
    const users = await this.users.find();
    const userById = new Map(users.map((row) => [row.id, row]));
    const planDto: Plan = {
      id: plan.id,
      eventId: plan.eventId,
      participants: rows.flatMap((row) => {
        const user = userById.get(row.userId);
        return user ? [{ friend: toFriendDto(user), status: row.status as PlanParticipantStatus }] : [];
      }),
      meetingPoint: plan.meetingPoint,
      meetingAt: plan.meetingAt.toISOString(),
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    };
    let distanceMeters = 0;
    if (origin && event.placeId) {
      const place = await this.places.findOneBy({ id: event.placeId });
      if (place) distanceMeters = haversineMeters(origin, place.latitude, place.longitude);
    }
    return { plan: planDto, event: toEventDto(event), distanceMeters };
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof QueryFailedError && error.driverError?.code === "23505";
}
