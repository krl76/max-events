// START_MODULE_CONTRACT
// PURPOSE: Shared in-memory harness for the plans tests — repositories, fixtures and a built PlansService.
// SCOPE: createPlansService() with store-backed fakes that understand the find operators the service uses (IsNull) and TypeORM's save of one row or many; ids and fixtures the plan suites share. No HTTP, no database.
// DEPENDS: typeorm, @nestjs/common, @max-events/api-contracts, plans/places/events/users entities, ./plans.service
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - now - fixed clock the fixtures are written against
// - hostId - fixture host user id
// - dimaId - fixture invitee id
// - katyaId - second fixture invitee id
// - eventId - fixture event id
// - placeId - fixture place id
// - meetingAt - fixture meeting time
// - matchesWhere - the where shapes the fakes understand
// - createStoreRepo - in-memory repository double
// - createService - PlansService with the fakes wired in
// END_MODULE_MAP

import { FindOperator, QueryFailedError, type Repository } from "typeorm";
import type { Friend } from "@max-events/api-contracts";
import { EventEntity } from "../events/event.entity";
import type { FriendsService } from "../friends/friends.service";
import type { MaxBotClient } from "../max-bot/max-bot.client";
import { PlaceEntity } from "../places/place.entity";
import { UserEntity } from "../users/user.entity";
import { PlanExpenseEntity } from "./plan-expense.entity";
import { PlanParticipantEntity } from "./plan-participant.entity";
import { PlanEntity } from "./plan.entity";
import { PlansService } from "./plans.service";

export const now = new Date("2026-09-12T10:00:00Z");
export const hostId = "00000000-0000-4000-8000-00000000000a";
export const dimaId = "00000000-0000-4000-8000-0000000000b1";
export const katyaId = "00000000-0000-4000-8000-0000000000b2";
export const eventId = "00000000-0000-4000-8000-0000000000e1";
export const placeId = "00000000-0000-4000-8000-0000000000p1";
export const meetingAt = "2026-09-12T11:00:00.000Z";

function user(id: string, maxUserId: string, firstName: string): UserEntity {
  return { id, maxUserId, firstName, lastName: null, avatarUrl: null, createdAt: now, updatedAt: now } as UserEntity;
}

function eventRow(): EventEntity {
  return {
    id: eventId,
    title: "The Weekend Tribute",
    description: "",
    category: "afisha",
    city: "Москва",
    placeId,
    startsAt: new Date("2026-09-12T16:00:00Z"),
    endsAt: null,
    isPaid: true,
    priceRub: 850,
    paymentUrl: "https://example.com/pay",
    capacity: null,
    bookedCount: 0,
    published: true,
    chatLink: null,
    chatSyncPending: false,
    createdAt: now,
    updatedAt: now,
  } as EventEntity;
}

/** Understands the two shapes the service asks for: an exact value and IsNull(). */
export function matchesWhere(row: unknown, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = (row as Record<string, unknown>)[key];
    if (expected instanceof FindOperator) return expected.type === "isNull" ? actual === null || actual === undefined : (expected.value as unknown[]).includes(actual);
    return actual === expected;
  });
}

export function createStoreRepo<T extends { id?: string }>(initial: T[] = []) {
  const store = [...initial];
  let seq = 0;
  const repo = {
    store,
    create: (fields: Partial<T>) => ({ ...fields }) as T,
    find: async (opts: { where?: Record<string, unknown> } = {}) => store.filter((row) => matchesWhere(row, opts.where ?? {})),
    findOneBy: async (where: Record<string, unknown>) => store.find((row) => matchesWhere(row, where)) ?? null,
    // TypeORM's save takes one row or many; without this the fake would quietly accept an array and
    // store it as a single row.
    save: async <E extends T | T[]>(entity: E): Promise<E> => {
      if (Array.isArray(entity)) {
        for (const row of entity) await repo.save(row);
        return entity;
      }
      const row = entity as T;
      if (!store.includes(row)) {
        const rec = entity as { seriesId?: string | null; meetingAt?: Date };
        const seriesId = rec.seriesId;
        const meetingAt = rec.meetingAt;
        if (seriesId && meetingAt instanceof Date) {
          const stamp = meetingAt.getTime();
          const dup = store.find((row) => {
            const other = row as { seriesId?: string | null; meetingAt?: Date };
            return other.seriesId === seriesId && other.meetingAt instanceof Date && other.meetingAt.getTime() === stamp;
          });
          if (dup) throw new QueryFailedError("INSERT", [], Object.assign(new Error("duplicate"), { code: "23505" }));
        }
        row.id ??= `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
        (entity as { createdAt?: Date }).createdAt ??= now;
        (entity as { updatedAt?: Date }).updatedAt ??= now;
        store.push(row);
      }
      return entity;
    },
    delete: async (where: { id: string }) => {
      const index = store.findIndex((row) => row.id === where.id);
      if (index < 0) return { affected: 0 };
      store.splice(index, 1);
      return { affected: 1 };
    },
  };
  return repo;
}

export function createService(options: { chatLink?: string | null } = {}) {
  const users = [user(hostId, "1", "Демо"), user(dimaId, "2", "Дима"), user(katyaId, "3", "Катя")];
  const place = { id: placeId, title: "Метро", address: "Крымский Вал", city: "Москва", category: "park", published: true, latitude: 55.747, longitude: 37.584, createdAt: now, updatedAt: now } as PlaceEntity;
  const food = {
    id: "00000000-0000-4000-8000-0000000000a3",
    title: "Депо",
    address: "Лесная, 1",
    city: "Москва",
    category: "food",
    published: true,
    latitude: 55.748,
    longitude: 37.585,
    createdAt: now,
    updatedAt: now,
  } as PlaceEntity;
  const plans = createStoreRepo<PlanEntity>();
  const participants = createStoreRepo<PlanParticipantEntity>();
  const events = createStoreRepo<EventEntity>([eventRow()]);
  const places = createStoreRepo<PlaceEntity>([place, food]);
  const userRepo = createStoreRepo<UserEntity>(users);
  const friends = {
    friendIds: async () => new Set([dimaId, katyaId]),
    list: async () =>
      [
        { id: dimaId, name: "Дима", avatarUrl: null },
        { id: katyaId, name: "Катя", avatarUrl: null },
      ] satisfies Friend[],
  } as unknown as FriendsService;
  const messages: string[] = [];
  const chatTitles: string[] = [];
  const bot = {
    createChat: async (title: string) => {
      chatTitles.push(title);
      if (options.chatLink === null) return null;
      return { chatId: 1, link: options.chatLink ?? "https://max.ru/join/plan" };
    },
    sendMessage: async (_id: string, text: string) => {
      messages.push(text);
      return true;
    },
  } as unknown as MaxBotClient;
  const expenses = createStoreRepo<PlanExpenseEntity>();
  const service = new PlansService(plans as unknown as Repository<PlanEntity>, participants as unknown as Repository<PlanParticipantEntity>, events as unknown as Repository<EventEntity>, places as unknown as Repository<PlaceEntity>, userRepo as unknown as Repository<UserEntity>, expenses as unknown as Repository<PlanExpenseEntity>, friends, bot);
  return { service, messages, plans, participants, chatTitles };
}
