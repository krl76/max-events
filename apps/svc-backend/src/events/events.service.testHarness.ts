import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { FindOperator, Repository } from "typeorm";
import { CreateEventSchema, type CreateEvent, type Event, type Place } from "@max-events/api-contracts";
import { MaxBotClient } from "../max-bot/max-bot.client";
import { PlacesService } from "../places/places.service";
import type { SubscriptionsService } from "../subscriptions/subscriptions.service";
import type { UsersService } from "../users/users.service";
import type { PromotionService } from "../promotion/promotion.service";
import type { WaitlistService } from "../waitlist/waitlist.service";
import type { ReviewsService } from "../reviews/reviews.service";
import { FriendshipEntity } from "../friends/friendship.entity";
import { ParticipationEntity } from "../participations/participation.entity";
import { EventEntity } from "./event.entity";
import type { EventWeatherService } from "./event-weather.service";
import { EventsService } from "./events.service";

export const placeId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f";
export const farPlaceId = "00000000-0000-4000-8000-0000000000b2";

export const payload: CreateEvent = CreateEventSchema.parse({
  title: "Джаз в парке",
  category: "afisha",
  city: "Москва",
  startsAt: "2026-09-12T19:00:00+03:00",
});

function createRepo(initial: EventEntity[] = []) {
  const store: EventEntity[] = [...initial];
  let seq = 0;
  const nextId = () => {
    seq += 1;
    return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
  };
  const now = () => new Date("2026-09-01T07:00:00Z");

  return {
    store,
    create: (fields: Partial<EventEntity>) => ({ ...fields }) as EventEntity,
    merge: (target: EventEntity, fields: Partial<EventEntity>) => Object.assign(target, fields),
    save: async (entity: EventEntity) => {
      if (!store.includes(entity)) {
        entity.id ??= nextId();
        entity.createdAt ??= now();
        entity.updatedAt ??= now();
        entity.published ??= true;
        store.push(entity);
      } else {
        entity.updatedAt = now();
      }
      return entity;
    },
    findOneBy: async (where: { id: string }) => store.find((row) => row.id === where.id) ?? null,
    find: async (opts: { where?: Record<string, unknown> | Array<Record<string, unknown>>; order?: { startsAt?: "ASC" | "DESC"; id?: "ASC" | "DESC"; createdAt?: "ASC" | "DESC" }; skip?: number; take?: number }) => {
      const clauses = Array.isArray(opts.where) ? opts.where : opts.where ? [opts.where] : [{}];
      let rows = store.filter((row) => clauses.some((clause) => matchesEventWhere(row, clause)));
      if (opts.order?.createdAt === "ASC") rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
      else rows.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.id.localeCompare(b.id));
      const from = opts.skip ?? 0;
      return opts.take === undefined ? rows.slice(from) : rows.slice(from, from + opts.take);
    },
    delete: async (where: { id: string }) => {
      const index = store.findIndex((row) => row.id === where.id);
      if (index < 0) return { affected: 0 };
      store.splice(index, 1);
      return { affected: 1 };
    },
  };
}

function matchesEventWhere(row: EventEntity, clause: Record<string, unknown>): boolean {
  if (clause.published === true && !row.published) return false;
  const ids = clause.id as FindOperator<string> | undefined;
  if (ids && !(ids.value as unknown as string[]).includes(row.id)) return false;
  if (!matchesTextOperator(row.title, clause.title)) return false;
  if (!matchesTextOperator(row.description, clause.description)) return false;
  if (clause.city && row.city !== clause.city) return false;
  if (clause.category && row.category !== clause.category) return false;
  if (clause.organizerUserId && row.organizerUserId !== clause.organizerUserId) return false;
  if (clause.organizerOrganizationId && row.organizerOrganizationId !== clause.organizerOrganizationId) return false;
  if (clause.chatSyncPending !== undefined && row.chatSyncPending !== clause.chatSyncPending) return false;
  const chatLink = clause.chatLink as FindOperator<string> | undefined;
  if (chatLink?.type === "isNull" && row.chatLink !== null) return false;
  const startsAt = clause.startsAt as FindOperator<Date> | undefined;
  if (startsAt && !matchesDateOperator(row.startsAt, startsAt)) return false;
  return true;
}

function matchesTextOperator(value: string, clause: unknown): boolean {
  if (clause === undefined) return true;
  if (clause && typeof clause === "object" && (clause as FindOperator<string>).type === "ilike") {
    const pattern = String((clause as FindOperator<string>).value ?? "");
    const needle = pattern.startsWith("%") && pattern.endsWith("%") ? pattern.slice(1, -1) : pattern;
    return value.toLowerCase().includes(needle.toLowerCase());
  }
  if (typeof clause === "string") return value === clause;
  return true;
}

function matchesDateOperator(value: Date, operator: FindOperator<Date>): boolean {
  if (operator.type === "and") return (operator.value as unknown as FindOperator<Date>[]).every((inner) => matchesDateOperator(value, inner));
  const bound = operator.value as unknown as Date;
  if (operator.type === "moreThanOrEqual") return value.getTime() >= bound.getTime();
  if (operator.type === "lessThan") return value.getTime() < bound.getTime();
  if (operator.type === "lessThanOrEqual") return value.getTime() <= bound.getTime();
  throw new Error(`unsupported find operator in fake repository: ${operator.type}`);
}

function passthroughWeather(): EventWeatherService {
  return { attach: async (events: Event[]) => events } as unknown as EventWeatherService;
}

export function createService(options: { placeIds?: string[]; draftPlaceIds?: string[]; ownerId?: string; store?: EventEntity[]; bot?: Pick<MaxBotClient, "createChat">; waitlist?: WaitlistService; banned?: boolean; promotions?: PromotionService; weather?: EventWeatherService; ratedIds?: Record<number, string[]>; averages?: Record<string, number>; organization?: { id: string; organizerUserId: string }; interests?: string[] } = {}) {
  const knownPlaces = new Set(options.placeIds ?? []);
  const draftPlaces = new Set(options.draftPlaceIds ?? []);
  const chatCalls: string[] = [];
  const notifyCalls: string[] = [];
  const innerBot = options.bot ?? { createChat: async () => null };
  const places = {
    getById: async (id: string) => {
      if (!knownPlaces.has(id)) throw new NotFoundException("Place not found");
      return { id } as Place;
    },
    findByIds: async (ids: string[]) =>
      ids
        .filter((id) => knownPlaces.has(id))
        .map((id) => ({
          id,
          title: "Площадка",
          latitude: id === farPlaceId ? 56.75 : 55.75,
          longitude: 37.62,
        })),
    resolveForEventBind: async (id: string, actorId?: string) => {
      if (knownPlaces.has(id)) return;
      if (draftPlaces.has(id) && actorId && actorId === options.ownerId) return;
      throw new NotFoundException("Place not found");
    },
  } as unknown as PlacesService;
  const repo = createRepo(options.store ?? []);
  const bot = {
    createChat: async (title: string) => {
      chatCalls.push(title);
      return innerBot.createChat(title);
    },
  };
  const subscriptions = {
    notifyNewEvent: async (event: EventEntity) => {
      notifyCalls.push(event.id);
      return { sent: 0, failed: 0 };
    },
  } as unknown as SubscriptionsService;
  const users = {
    assertCanPublish: async () => {
      if (options.banned) throw new ForbiddenException("Organizer is banned from publishing");
    },
    findByIds: async () => [],
  } as unknown as UsersService;
  const waitlist = options.waitlist ?? ({ fillVacancies: async () => undefined, queueCountsByEventIds: async () => new Map() } as unknown as WaitlistService);
  const promotions = options.promotions ?? ({ listActive: async () => [], promotedEventIds: async () => new Set<string>() } as unknown as PromotionService);
  const weather = options.weather ?? passthroughWeather();
  const ratedIdsByThreshold = options.ratedIds ?? {};
  const reviews = {
    eventIdsRatedAtLeast: async (minStars: number) => ratedIdsByThreshold[minStars] ?? [],
    averagesByEventIds: async (ids: string[]) => {
      const map = new Map<string, number>();
      for (const id of ids) {
        const value = options.averages?.[id];
        if (value !== undefined) map.set(id, value);
      }
      return map;
    },
  } as unknown as ReviewsService;
  const friendships = { find: async () => [] } as unknown as Repository<FriendshipEntity>;
  const participations = { find: async () => [] } as unknown as Repository<ParticipationEntity>;
  const organizations = {
    findById: async (id: string) => (options.organization?.id === id ? options.organization : null),
    findByOrganizerUserId: async (organizerUserId: string) => (options.organization?.organizerUserId === organizerUserId ? options.organization : null),
  };
  const profiles = { getOrCreate: async () => ({ interests: options.interests ?? [] }) } as never;
  const service = new EventsService(repo as unknown as Repository<EventEntity>, places, bot as MaxBotClient, subscriptions, users, waitlist, promotions, weather, reviews, friendships, participations, organizations as never, profiles);
  return { repo, service, waitlist, chatCalls, notifyCalls };
}
