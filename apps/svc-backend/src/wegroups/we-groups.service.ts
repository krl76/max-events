// START_MODULE_CONTRACT
// PURPOSE: «Мы» trip groups — members, MAX chat, bound events/places, archive to history.
// SCOPE: create with members+chat; addEvent/addPlace; list/get; archive by owner; screen aggregates bookings, route, budget, photos.
// DEPENDS: typeorm, @max-events/api-contracts, events/places/users/max-bot, bookings/plans/reviews/routes
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - WeGroupsService - membership-gated group lifecycle
// - toWeGroupDto - entity to WeGroup
// END_MODULE_MAP

import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, QueryFailedError, Repository } from "typeorm";
import type { Booking, CreateWeGroupWrite, DayRoute, Friend, PlanBudget, ReviewPhoto, RoutePoint, WeGroup, WeGroupScreen, WeGroupSummary } from "@max-events/api-contracts";
import { BookingEntity } from "../bookings/booking.entity";
import { toEventDto } from "../events/event.mapper";
import { EventEntity } from "../events/event.entity";
import { toFriendDto } from "../friends/friends.service";
import { MaxBotClient } from "../max-bot/max-bot.client";
import { PlanExpenseEntity } from "../plans/plan-expense.entity";
import { PlanEntity } from "../plans/plan.entity";
import { budgetFromExpenses } from "../plans/plans.service";
import { toPlaceDto } from "../places/places.service";
import { PlaceEntity } from "../places/place.entity";
import { ParticipationEntity } from "../participations/participation.entity";
import { ReviewEntity } from "../reviews/review.entity";
import { toDayRoute } from "../routes/routes.service";
import { UserEntity } from "../users/user.entity";
import { WeGroupEntity, WeGroupItemEntity, WeGroupMemberEntity, WeGroupPhotoEntity } from "./we-group.entity";

@Injectable()
export class WeGroupsService {
  private readonly logger = new Logger(WeGroupsService.name);

  constructor(
    @InjectRepository(WeGroupEntity) private readonly groups: Repository<WeGroupEntity>,
    @InjectRepository(WeGroupMemberEntity) private readonly members: Repository<WeGroupMemberEntity>,
    @InjectRepository(WeGroupItemEntity) private readonly items: Repository<WeGroupItemEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(PlaceEntity) private readonly places: Repository<PlaceEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(BookingEntity) private readonly bookings: Repository<BookingEntity>,
    @InjectRepository(PlanEntity) private readonly plans: Repository<PlanEntity>,
    @InjectRepository(PlanExpenseEntity) private readonly expenses: Repository<PlanExpenseEntity>,
    @InjectRepository(ReviewEntity) private readonly reviews: Repository<ReviewEntity>,
    @InjectRepository(ParticipationEntity) private readonly participations: Repository<ParticipationEntity>,
    @InjectRepository(WeGroupPhotoEntity) private readonly groupPhotos: Repository<WeGroupPhotoEntity>,
    @Inject(MaxBotClient) private readonly bot: MaxBotClient,
  ) {}

  async create(ownerUserId: string, payload: CreateWeGroupWrite): Promise<WeGroupScreen> {
    const memberIds = [...new Set([ownerUserId, ...payload.memberIds])];
    const users = memberIds.length === 0 ? [] : await this.users.find({ where: { id: In(memberIds) } });
    if (users.length !== memberIds.length) throw new NotFoundException("User not found");
    const title = payload.title.trim();
    if (!title) throw new BadRequestException("Invalid we-group payload");
    const saved = await this.groups.save(this.groups.create({ ownerUserId, title, chatLink: null, status: "active", archivedAt: null }));
    for (const userId of memberIds) {
      await this.members.save(this.members.create({ groupId: saved.id, userId }));
    }
    const chat = await this.bot.createChat(saved.title);
    if (chat) {
      saved.chatLink = chat.link;
      await this.groups.save(saved);
    }
    return this.get(ownerUserId, saved.id);
  }

  async listForUser(userId: string): Promise<WeGroupSummary[]> {
    const memberships = await this.members.find({ where: { userId } });
    const groupIds = memberships.map((row) => row.groupId);
    if (groupIds.length === 0) return [];
    const groups = await this.groups.find({ where: { id: In(groupIds) }, order: { createdAt: "DESC", id: "ASC" } });
    return Promise.all(groups.map((group) => this.toSummary(group)));
  }

  async photos(actorId: string, groupId: string): Promise<ReviewPhoto[]> {
    const screen = await this.get(actorId, groupId);
    return screen.photos;
  }

  async get(actorId: string, groupId: string): Promise<WeGroupScreen> {
    const group = await this.requireMember(actorId, groupId);
    return this.toScreen(group);
  }

  async addEvent(actorId: string, groupId: string, eventId: string): Promise<WeGroupScreen> {
    const group = await this.requireActiveMember(actorId, groupId);
    const event = await this.events.findOneBy({ id: eventId });
    if (!event || event.published === false) throw new NotFoundException("Event not found");
    try {
      await this.items.save(this.items.create({ groupId: group.id, eventId, placeId: null }));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
    return this.get(actorId, groupId);
  }

  async addPlace(actorId: string, groupId: string, placeId: string): Promise<WeGroupScreen> {
    const group = await this.requireActiveMember(actorId, groupId);
    const place = await this.places.findOneBy({ id: placeId });
    if (!place || place.published === false) throw new NotFoundException("Place not found");
    try {
      await this.items.save(this.items.create({ groupId: group.id, eventId: null, placeId }));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
    return this.get(actorId, groupId);
  }

  async addPhoto(actorId: string, groupId: string, url: string): Promise<WeGroupScreen> {
    const group = await this.requireActiveMember(actorId, groupId);
    await this.groupPhotos.save(this.groupPhotos.create({ groupId: group.id, userId: actorId, url }));
    return this.get(actorId, groupId);
  }

  async archive(actorId: string, groupId: string, now = new Date()): Promise<WeGroupScreen> {
    const group = await this.requireMember(actorId, groupId);
    if (group.ownerUserId !== actorId) throw new ForbiddenException("Only the owner can archive the group");
    if (group.status === "archived") return this.toScreen(group);
    group.status = "archived";
    group.archivedAt = now;
    await this.groups.save(group);
    return this.toScreen(group);
  }

  private async requireActiveMember(actorId: string, groupId: string): Promise<WeGroupEntity> {
    const group = await this.requireMember(actorId, groupId);
    if (group.status === "archived") throw new ConflictException("Group is archived");
    return group;
  }

  private async requireMember(actorId: string, groupId: string): Promise<WeGroupEntity> {
    const group = await this.groups.findOneBy({ id: groupId });
    if (!group) throw new NotFoundException("Group not found");
    const membership = await this.members.findOneBy({ groupId, userId: actorId });
    if (!membership && group.ownerUserId !== actorId) throw new ForbiddenException("Not a group member");
    return group;
  }

  private async toScreen(group: WeGroupEntity): Promise<WeGroupScreen> {
    const [memberRows, itemRows] = await Promise.all([this.members.find({ where: { groupId: group.id } }), this.items.find({ where: { groupId: group.id } })]);
    const userIds = memberRows.map((row) => row.userId);
    const users = userIds.length === 0 ? [] : await this.users.find({ where: { id: In(userIds) } });
    const userById = new Map(users.map((row) => [row.id, row]));
    const eventIds = itemRows.map((row) => row.eventId).filter((id): id is string => id !== null);
    const placeIds = itemRows.map((row) => row.placeId).filter((id): id is string => id !== null);
    const events = eventIds.length === 0 ? [] : await this.events.find({ where: { id: In(eventIds), published: true } });
    const places = placeIds.length === 0 ? [] : await this.places.find({ where: { id: In(placeIds), published: true } });
    const memberIds = [...new Set([group.ownerUserId, ...memberRows.map((row) => row.userId)])];
    const members = memberRows
      .map((row) => userById.get(row.userId))
      .filter((row): row is UserEntity => row !== undefined)
      .map(toFriendDto);
    const uploaded = await this.groupPhotos.find({ where: { groupId: group.id } });
    const reviewPhotos = await this.memberPhotos(
      memberIds,
      events.map((row) => row.id),
    );
    const photos = [...uploaded.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).map((row) => ({ url: row.url })), ...reviewPhotos];
    return {
      group: toWeGroupDto(group),
      members,
      events: events.map((row) => toEventDto(row)),
      places: places.map(toPlaceDto),
      bookings: await this.memberBookings(
        memberIds,
        events.map((row) => row.id),
      ),
      route: await this.groupRoute(events, places),
      budget: await this.groupBudget(
        memberIds,
        events.map((row) => row.id),
      ),
      photos,
      photosTotal: photos.length,
      goingByEvent: await this.goingByEvent(memberIds, events, members),
    };
  }

  private async toSummary(group: WeGroupEntity): Promise<WeGroupSummary> {
    const screen = await this.toScreen(group);
    const now = Date.now();
    const upcoming = screen.events.filter((event) => Date.parse(event.startsAt) >= now).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return {
      group: screen.group,
      membersCount: screen.members.length,
      upcomingEventsCount: upcoming.length,
      photosTotal: screen.photosTotal,
      budgetTotalRub: screen.budget?.totalRub ?? null,
      nextEventTitle: upcoming[0]?.title ?? null,
    };
  }

  private async goingByEvent(memberIds: string[], events: EventEntity[], members: Friend[]): Promise<Array<{ eventId: string; going: Friend[] }>> {
    if (memberIds.length === 0 || events.length === 0) return events.map((event) => ({ eventId: event.id, going: [] }));
    const rows = await this.participations.find({ where: { userId: In(memberIds), eventId: In(events.map((row) => row.id)) } });
    const memberById = new Map(members.map((member) => [member.id, member]));
    return events.map((event) => ({
      eventId: event.id,
      going: rows
        .filter((row) => row.eventId === event.id && row.status === "going")
        .flatMap((row) => {
          const member = memberById.get(row.userId);
          return member ? [member] : [];
        }),
    }));
  }

  private async memberBookings(memberIds: string[], eventIds: string[]): Promise<Booking[]> {
    if (memberIds.length === 0 || eventIds.length === 0) return [];
    const rows = await this.bookings.find({ where: { userId: In(memberIds), eventId: In(eventIds), status: "active" } });
    return rows
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
      .map((row) => ({
        id: row.id,
        userId: row.userId,
        eventId: row.eventId,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
  }

  private async groupRoute(events: EventEntity[], places: PlaceEntity[]): Promise<DayRoute | null> {
    const points: RoutePoint[] = [];
    const usedPlaces = new Set<string>();
    const sortedEvents = [...events].filter((row) => row.placeId).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.id.localeCompare(b.id));
    for (const event of sortedEvents) {
      const place = await this.places.findOneBy({ id: event.placeId! });
      if (!place) {
        this.logger.warn(`We-group route skipped event ${event.id}: place missing`);
        continue;
      }
      points.push({ title: event.title, at: event.startsAt.toISOString(), latitude: place.latitude, longitude: place.longitude, eventId: event.id, placeId: place.id });
      usedPlaces.add(place.id);
    }
    const extraPlaces = [...places].filter((row) => !usedPlaces.has(row.id)).sort((a, b) => a.id.localeCompare(b.id));
    for (const place of extraPlaces) {
      points.push({ title: place.title, at: null, latitude: place.latitude, longitude: place.longitude, eventId: null, placeId: place.id });
    }
    const sliced = points.slice(0, 8);
    if (sliced.length < 2) return null;
    return toDayRoute(sliced);
  }

  private async groupBudget(memberIds: string[], eventIds: string[]): Promise<PlanBudget | null> {
    if (eventIds.length === 0) return null;
    const memberSet = new Set(memberIds);
    const eventSet = new Set(eventIds);
    const plans = (await this.plans.find()).filter((row) => eventSet.has(row.eventId) && memberSet.has(row.hostUserId) && !row.cancelledAt);
    if (plans.length === 0) return null;
    const planIds = new Set(plans.map((row) => row.id));
    const rows = (await this.expenses.find()).filter((row) => planIds.has(row.planId));
    if (rows.length === 0) return null;
    return budgetFromExpenses(rows);
  }

  private async memberPhotos(memberIds: string[], eventIds: string[]): Promise<ReviewPhoto[]> {
    if (memberIds.length === 0 || eventIds.length === 0) return [];
    const memberSet = new Set(memberIds);
    const eventSet = new Set(eventIds);
    const rows = (await this.reviews.find()).filter((row) => memberSet.has(row.userId) && eventSet.has(row.eventId));
    const photos: ReviewPhoto[] = [];
    for (const row of rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))) {
      for (const url of row.photoUrls ?? []) {
        if (typeof url === "string" && url.length > 0) photos.push({ url });
      }
    }
    return photos;
  }
}

export function toWeGroupDto(row: WeGroupEntity): WeGroup {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    title: row.title,
    chatLink: row.chatLink,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof QueryFailedError && error.driverError?.code === "23505";
}
