// START_MODULE_CONTRACT
// PURPOSE: Event persistence — CRUD and catalog list mapped to api-contracts Event.
// SCOPE: Create/read/update/delete, optional place FK, payment-link invariant, catalog filters on city/category/start date/q pushed into SQL and capped by limit/offset; sort is a whitelist (soon/near/rating); the rating filter narrows by event id before the page is read, so limit/offset describe the filtered catalog.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, ../places/places.service, ../reviews/reviews.service, ./event.entity
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - EventListQuery - catalog list filters including q and sort
// - EVENT_SORTS - whitelist of catalog orderings the list may ask for
// - EventSort - one allowed catalog ordering
// - EVENT_LIST_MAX_LIMIT - hard cap on catalog rows read per request
// - EVENT_LIST_SCAN_CAP - rows scanned when rating/near cannot be cut in SQL
// - CHAT_SYNC_BATCH - events retried per chat-sync tick
// - pickEventFields - patch keys allowed on update
// - EventsService - CRUD + list against EventEntity + chat-sync retry
// - toEventDto - map EventEntity to the api-contracts Event shape
// END_MODULE_MAP

import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { And, FindOperator, ILike, In, IsNull, LessThan, LessThanOrEqual, MoreThanOrEqual, Repository } from "typeorm";
import { CreateEventSchema, EventSchema, type CatalogCard, type CreateEvent, type Event, type EventCategory } from "@max-events/api-contracts";
import { MaxBotClient } from "../max-bot/max-bot.client";
import { PlacesService } from "../places/places.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { ProfilesService } from "../users/profiles.service";
import { isOrganizerOwner } from "../organizations/organizer-ownership";
import { UsersService } from "../users/users.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { PromotionService } from "../promotion/promotion.service";
import { ReviewsService } from "../reviews/reviews.service";
import { WaitlistService } from "../waitlist/waitlist.service";
import { FriendshipEntity } from "../friends/friendship.entity";
import { ParticipationEntity } from "../participations/participation.entity";
import { haversineKm } from "../geo/haversine";
import { EventEntity } from "./event.entity";
import { EventWeatherService } from "./event-weather.service";
import { toEventDto } from "./event.mapper";

export { toEventDto } from "./event.mapper";

export const EVENT_SORTS = ["soon", "near", "rating"] as const;
export type EventSort = (typeof EVENT_SORTS)[number];

export type EventListQuery = {
  city?: string;
  category?: EventCategory;
  date?: string;
  dateFrom?: Date;
  dateTo?: Date;
  /** Average review score the event must reach; an event nobody reviewed never qualifies. */
  minRating?: number;
  /** Case-insensitive needle over title and description. */
  q?: string;
  /** Explicit catalog order; omitted keeps boost-then-soonest. */
  sort?: EventSort;
  limit?: number;
  offset?: number;
  latitude?: number;
  longitude?: number;
  viewerId?: string;
};

/** Ceiling on rows a single catalog read may pull; also the default when the caller names no limit. */
export const EVENT_LIST_MAX_LIMIT = 100;

/** Rows scanned when rating/near cannot page in SQL. */
export const EVENT_LIST_SCAN_CAP = 500;

/** Events a single chat-sync tick retries, so a long backlog is drained over several ticks. */
export const CHAT_SYNC_BATCH = 20;

const DAY_MS = 86_400_000;

const EVENT_PATCH_KEYS = ["title", "description", "category", "city", "placeId", "startsAt", "endsAt", "isPaid", "priceRub", "paymentUrl", "capacity", "coverUrl"] as const;

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(EventEntity)
    private readonly events: Repository<EventEntity>,
    @Inject(PlacesService) private readonly places: PlacesService,
    @Inject(MaxBotClient) private readonly bot: MaxBotClient,
    @Inject(SubscriptionsService) private readonly subscriptions: SubscriptionsService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(WaitlistService) private readonly waitlist: WaitlistService,
    @Inject(PromotionService) private readonly promotions: PromotionService,
    @Inject(EventWeatherService) private readonly eventWeather: EventWeatherService,
    @Inject(ReviewsService) private readonly reviews: ReviewsService,
    @InjectRepository(FriendshipEntity) private readonly friendships: Repository<FriendshipEntity>,
    @InjectRepository(ParticipationEntity) private readonly participations: Repository<ParticipationEntity>,
    @Inject(OrganizationsService) private readonly organizations: OrganizationsService,
    @Inject(ProfilesService) private readonly profiles: ProfilesService,
  ) {}

  private async ownerFields(actorId?: string): Promise<{ organizerUserId: string | null; organizerOrganizationId: string | null }> {
    if (!actorId) return { organizerUserId: null, organizerOrganizationId: null };
    const asOrg = await this.organizations.findById(actorId);
    if (asOrg) return { organizerOrganizationId: asOrg.id, organizerUserId: asOrg.organizerUserId };
    const asUserOrg = await this.organizations.findByOrganizerUserId(actorId);
    return { organizerOrganizationId: asUserOrg?.id ?? null, organizerUserId: actorId };
  }

  async create(payload: CreateEvent, organizerUserId?: string, options?: { draft?: boolean }): Promise<Event> {
    const owner = await this.ownerFields(organizerUserId);
    if (owner.organizerUserId) await this.users.assertCanPublish(owner.organizerUserId);
    await assertPlaceBound(this.places, payload.placeId, organizerUserId, { requirePublished: !options?.draft });
    assertTimeRange(payload.startsAt, payload.endsAt);
    const saved = await this.events.save(
      this.events.create({
        ...toColumns(payload),
        published: options?.draft ? false : true,
        bookedCount: 0,
        chatLink: null,
        chatSyncPending: true,
        organizerUserId: owner.organizerUserId,
        organizerOrganizationId: owner.organizerOrganizationId,
      }),
    );
    if (!options?.draft) {
      try {
        await this.subscriptions.notifyNewEvent(saved);
      } catch {
        // Creating the catalog row must not fail because a subscriber DM failed.
      }
      return toEventDto(await attachChatLink(this.events, this.bot, saved));
    }
    return toEventDto(saved);
  }

  async getById(id: string): Promise<Event> {
    const found = await this.requirePublished(id);
    const promoted = (await this.promotions.promotedEventIds()).has(found.id);
    const [withWeather] = await this.eventWeather.attach([toEventDto(found, { promoted })]);
    return withWeather ?? toEventDto(found, { promoted });
  }

  /** Published catalog row without a weather round-trip; the hourly strip fetches its own series. */
  async getPublished(id: string): Promise<Event> {
    return toEventDto(await this.requirePublished(id));
  }

  private async requirePublished(id: string): Promise<EventEntity> {
    const found = await this.events.findOneBy({ id });
    if (!found || found.published === false) throw new NotFoundException("Event not found");
    return found;
  }

  async update(id: string, patch: Record<string, unknown>, actorId?: string): Promise<Event> {
    const existing = await this.events.findOneBy({ id });
    if (!existing) throw new NotFoundException("Event not found");
    assertOrganizer(existing, actorId);
    const merged = EventSchema.safeParse({ ...toEventDto(existing), ...pickEventFields(patch) });
    if (!merged.success) throw new BadRequestException("Invalid event payload");
    await assertPlaceBound(this.places, merged.data.placeId, actorId, { requirePublished: existing.published !== false });
    assertTimeRange(merged.data.startsAt, merged.data.endsAt);
    const previousCapacity = existing.capacity;
    const saved = await this.events.save(this.events.merge(existing, toColumns(merged.data)));
    if (saved.capacity !== null && (previousCapacity === null || saved.capacity > previousCapacity)) {
      await this.waitlist.fillVacancies(saved.id);
    }
    return toEventDto(saved);
  }

  async unpublish(id: string): Promise<void> {
    const found = await this.events.findOneBy({ id });
    if (!found) throw new NotFoundException("Event not found");
    found.published = false;
    await this.events.save(found);
  }

  /**
   * Retry the MAX chat for events whose creation found the Bot API down. Without a reader of
   * chatSyncPending those events kept the flag forever and never got the auto-chat (M9).
   * Returns how many events gained a chat link on this pass.
   */
  async syncPendingChats(limit = CHAT_SYNC_BATCH): Promise<number> {
    const pending = await this.events.find({
      where: { chatSyncPending: true, chatLink: IsNull(), published: true },
      order: { createdAt: "ASC", id: "ASC" },
      take: limit,
    });
    let linked = 0;
    for (const event of pending) {
      const synced = await attachChatLink(this.events, this.bot, event);
      if (synced.chatLink) linked += 1;
    }
    return linked;
  }

  async remove(id: string, actorId?: string): Promise<void> {
    const existing = await this.events.findOneBy({ id });
    if (!existing) throw new NotFoundException("Event not found");
    assertOrganizer(existing, actorId);
    await this.events.delete({ id });
  }

  async listMine(actorId: string): Promise<Event[]> {
    const rows = await this.events.find({
      where: [{ organizerOrganizationId: actorId }, { organizerUserId: actorId }],
      order: { startsAt: "ASC", id: "ASC" },
    });
    const seen = new Set<string>();
    return rows
      .filter((row) => {
        if (seen.has(row.id)) return false;
        seen.add(row.id);
        return true;
      })
      .map((row) => toEventDto(row));
  }

  async publish(id: string, actorId: string): Promise<Event> {
    const owner = await this.ownerFields(actorId);
    if (owner.organizerUserId) await this.users.assertCanPublish(owner.organizerUserId);
    const existing = await this.events.findOneBy({ id });
    if (!existing) throw new NotFoundException("Event not found");
    assertOrganizer(existing, actorId);
    if (existing.placeId) {
      try {
        await this.places.getById(existing.placeId);
      } catch (error) {
        if (error instanceof NotFoundException) throw new BadRequestException("Place must be published");
        throw error;
      }
    }
    const firstPublish = existing.published === false;
    existing.published = true;
    const saved = await this.events.save(existing);
    const withChat = await attachChatLink(this.events, this.bot, saved);
    if (firstPublish) {
      try {
        await this.subscriptions.notifyNewEvent(withChat);
      } catch {
        // Publishing must not fail because a subscriber DM failed.
      }
    }
    return toEventDto(withChat);
  }

  async list(query: EventListQuery, now = new Date()): Promise<Event[]> {
    const whereBase: { published: true; city?: string; category?: EventCategory; startsAt?: FindOperator<Date>; id?: FindOperator<string> } = { published: true };
    if (query.city) whereBase.city = query.city;
    if (query.category) whereBase.category = query.category;
    if (query.minRating !== undefined) {
      // Resolved before the page is read, so limit/offset still describe the filtered catalog.
      const rated = await this.reviews.eventIdsRatedAtLeast(query.minRating);
      if (rated.length === 0) return [];
      whereBase.id = In(rated);
    }
    // The start window belongs in SQL: filtering it in memory meant reading every published event
    // to answer "what is on Saturday".
    const window = startWindow(query);
    if (window) whereBase.startsAt = window;
    const like = query.q ? containsPattern(query.q) : null;
    if (query.q && like === null) return [];
    const hinted = query.category === undefined && query.q ? categoryHintFromQuery(query.q) : null;
    const where = like
      ? [
          { ...whereBase, title: ILike(like) },
          { ...whereBase, description: ILike(like) },
          ...(hinted === null ? [] : [{ ...whereBase, category: hinted }]),
        ]
      : whereBase;
    const pageOffset = query.offset ?? 0;
    const pageTake = Math.min(query.limit ?? EVENT_LIST_MAX_LIMIT, EVENT_LIST_MAX_LIMIT);
    const hasOrigin = query.latitude !== undefined && query.longitude !== undefined;
    const scan = query.sort === "rating" || (query.sort === "near" && hasOrigin);
    const visibleRaw = await this.events.find({
      where,
      order: { startsAt: "ASC", id: "ASC" },
      skip: scan ? 0 : pageOffset,
      take: scan ? EVENT_LIST_SCAN_CAP : pageTake,
    });
    const seenIds = new Set<string>();
    const visible = visibleRaw.filter((row) => {
      if (seenIds.has(row.id)) return false;
      seenIds.add(row.id);
      return true;
    });
    const ordered = await this.orderCatalog(visible, query, now);
    const page = scan ? ordered.slice(pageOffset, pageOffset + pageTake) : ordered;
    const promoted = await this.promotions.promotedEventIds(now);
    const dtos = await this.eventWeather.attach(page.map((row) => toEventDto(row, { promoted: promoted.has(row.id) })));
    if (!query.viewerId && query.latitude === undefined) return dtos;
    return this.enrichList(page, dtos, query);
  }

  async listCards(query: EventListQuery, now = new Date()): Promise<CatalogCard[]> {
    const events = await this.list(query, now);
    const placeIds = [...new Set(events.map((event) => event.placeId).filter((id): id is string => id !== null))];
    const places = await this.places.findByIds(placeIds);
    const titleById = new Map(places.map((place) => [place.id, place.title]));
    return events.map((event) => ({
      event,
      distanceKm: event.distanceKm ?? null,
      rating: event.ratingAverage ?? null,
      placeTitle: event.placeId ? (titleById.get(event.placeId) ?? null) : null,
    }));
  }

  private async orderCatalog(rows: EventEntity[], query: EventListQuery, now: Date): Promise<EventEntity[]> {
    if (query.sort === "rating") {
      const averages = await this.reviews.averagesByEventIds(rows.map((row) => row.id));
      return [...rows].sort((a, b) => compareRating(averages.get(a.id), averages.get(b.id)) || a.startsAt.getTime() - b.startsAt.getTime() || a.id.localeCompare(b.id));
    }
    if (query.sort === "near" && query.latitude !== undefined && query.longitude !== undefined) {
      const placeIds = [...new Set(rows.map((row) => row.placeId).filter((id): id is string => id !== null))];
      const places = await this.places.findByIds(placeIds);
      const byId = new Map(places.map((place) => [place.id, place]));
      const dist = (row: EventEntity) => {
        const place = row.placeId ? byId.get(row.placeId) : undefined;
        return place ? haversineKm(query.latitude!, query.longitude!, place.latitude, place.longitude) : Number.POSITIVE_INFINITY;
      };
      return [...rows].sort((a, b) => dist(a) - dist(b) || a.startsAt.getTime() - b.startsAt.getTime() || a.id.localeCompare(b.id));
    }
    if (query.sort === "soon" || query.sort === "near") {
      return [...rows].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.id.localeCompare(b.id));
    }
    const boosts = await this.promotions.listActive(now, "boost");
    const boosted = new Set(boosts.map((row) => row.eventId));
    const interests = query.viewerId ? (await this.profiles.getOrCreate(query.viewerId)).interests : [];
    return [...rows].sort((a, b) => Number(boosted.has(b.id)) - Number(boosted.has(a.id)) || Number(matchesInterest(b, interests)) - Number(matchesInterest(a, interests)) || a.startsAt.getTime() - b.startsAt.getTime() || a.id.localeCompare(b.id));
  }

  private async enrichList(rows: EventEntity[], dtos: Event[], query: EventListQuery): Promise<Event[]> {
    if (rows.length === 0) return dtos;
    const eventIds = rows.map((row) => row.id);
    const placeIds = [...new Set(rows.map((row) => row.placeId).filter((id): id is string => id !== null))];
    const organizerIds = [...new Set(rows.map((row) => row.organizerUserId).filter((id): id is string => id !== null))];
    const [places, organizers, ratings, waitlists, going] = await Promise.all([this.places.findByIds(placeIds), this.users.findByIds(organizerIds), this.reviews.averagesByEventIds(eventIds), this.waitlist.queueCountsByEventIds(eventIds), query.viewerId ? this.goingFriends(query.viewerId, eventIds) : Promise.resolve(new Map<string, Array<{ id: string; name: string }>>())]);
    const placeById = new Map(places.map((place) => [place.id, place]));
    const organizerById = new Map(organizers.map((user) => [user.id, user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName]));
    const origin = query.latitude !== undefined && query.longitude !== undefined ? { latitude: query.latitude, longitude: query.longitude } : null;
    return dtos.map((dto, index) => {
      const row = rows[index]!;
      const place = row.placeId ? placeById.get(row.placeId) : undefined;
      const distanceKm = origin && place ? Math.round(haversineKm(origin.latitude, origin.longitude, place.latitude, place.longitude) * 10) / 10 : null;
      return {
        ...dto,
        distanceKm,
        organizerName: (row.organizerUserId ? organizerById.get(row.organizerUserId) : undefined) ?? place?.title ?? null,
        ratingAverage: ratings.get(dto.id) ?? null,
        waitlistCount: waitlists.get(dto.id) ?? 0,
        friendsGoing: going.get(dto.id) ?? [],
      };
    });
  }

  private async goingFriends(userId: string, eventIds: string[]): Promise<Map<string, Array<{ id: string; name: string }>>> {
    const going = new Map<string, Array<{ id: string; name: string }>>();
    const edges = await this.friendships.find({ where: { userId } });
    const friendIds = edges.map((row) => row.friendUserId);
    if (friendIds.length === 0) return going;
    const rows = await this.participations.find({ where: { eventId: In(eventIds), userId: In(friendIds), status: "going" } });
    const users = rows.length === 0 ? [] : await this.users.findByIds([...new Set(rows.map((row) => row.userId))]);
    const nameById = new Map(users.map((user) => [user.id, user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName]));
    for (const row of rows) {
      const name = nameById.get(row.userId);
      if (!name) continue;
      const list = going.get(row.eventId) ?? [];
      list.push({ id: row.userId, name });
      going.set(row.eventId, list);
    }
    return going;
  }
}

export function pickEventFields(patch: Record<string, unknown>): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const key of EVENT_PATCH_KEYS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) picked[key] = patch[key];
  }
  return picked;
}

function toColumns(payload: CreateEvent | Event): Omit<CreateEvent, "startsAt" | "endsAt"> & { startsAt: Date; endsAt: Date | null } {
  const parsed = CreateEventSchema.parse(payload);
  return {
    title: parsed.title,
    description: parsed.description,
    category: parsed.category,
    city: parsed.city,
    placeId: parsed.placeId,
    startsAt: new Date(parsed.startsAt),
    endsAt: parsed.endsAt ? new Date(parsed.endsAt) : null,
    isPaid: parsed.isPaid,
    priceRub: parsed.priceRub,
    paymentUrl: parsed.paymentUrl,
    capacity: parsed.capacity,
    coverUrl: parsed.coverUrl ?? null,
  };
}

/** The whole query names a category. A word inside a title, such as «джаз», stays a text search. */
export function categoryHintFromQuery(q: string): EventCategory | null {
  const text = q.trim().toLowerCase().replaceAll("ё", "е");
  if (/^(спорт|спортивное|спортивные|футбол|йога)$/.test(text)) return "sport";
  if (/^(волонтерство|субботник)$/.test(text)) return "volunteering";
  if (/^афиша$/.test(text)) return "afisha";
  if (/^(туризм|экскурсия|поход)$/.test(text)) return "tourism";
  return null;
}

function containsPattern(q: string): string | null {
  const compact = q
    .replace(/[%_\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return compact.length === 0 ? null : `%${compact}%`;
}

function compareRating(left: number | undefined, right: number | undefined): number {
  if (left === undefined && right === undefined) return 0;
  if (left === undefined) return 1;
  if (right === undefined) return -1;
  return right - left;
}

function startWindow(query: EventListQuery): FindOperator<Date> | undefined {
  const bounds: FindOperator<Date>[] = [];
  if (query.date) {
    const from = new Date(`${query.date}T00:00:00.000Z`);
    bounds.push(MoreThanOrEqual(from), LessThan(new Date(from.getTime() + DAY_MS)));
  }
  if (query.dateFrom) bounds.push(MoreThanOrEqual(query.dateFrom));
  if (query.dateTo) bounds.push(LessThanOrEqual(query.dateTo));
  if (bounds.length === 0) return undefined;
  return bounds.length === 1 ? bounds[0] : And(...bounds);
}

async function attachChatLink(events: Repository<EventEntity>, bot: MaxBotClient, saved: EventEntity): Promise<EventEntity> {
  if (saved.chatLink) return saved;
  let chat: Awaited<ReturnType<MaxBotClient["createChat"]>> = null;
  try {
    chat = await bot.createChat(saved.title);
  } catch {
    chat = null;
  }
  if (!chat) return saved;
  saved.chatLink = chat.link;
  saved.chatSyncPending = false;
  return events.save(saved);
}

async function assertPlaceBound(places: PlacesService, placeId: string | null, actorId?: string, options?: { requirePublished?: boolean }): Promise<void> {
  if (!placeId) return;
  try {
    if (options?.requirePublished) await places.getById(placeId);
    else await places.resolveForEventBind(placeId, actorId);
  } catch (error) {
    if (error instanceof NotFoundException) throw new BadRequestException(options?.requirePublished ? "Place must be published" : "Place not found");
    throw error;
  }
}

function assertOrganizer(row: { organizerUserId?: string | null; organizerOrganizationId?: string | null }, actorId?: string): void {
  if (!isOrganizerOwner(row, actorId)) throw new ForbiddenException("Not the organizer");
}

function matchesInterest(event: EventEntity, interests: string[]): boolean {
  if (interests.length === 0) return false;
  const haystack = `${event.category} ${event.title} ${event.description}`.toLowerCase();
  return interests.some((interest) => haystack.includes(interest.toLowerCase()));
}

function assertTimeRange(startsAt: string, endsAt: string | null): void {
  if (endsAt && new Date(endsAt) < new Date(startsAt)) {
    throw new BadRequestException("endsAt must not be before startsAt");
  }
}
