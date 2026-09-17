import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import type { Friend } from "@max-events/api-contracts";
import { EventEntity } from "../events/event.entity";
import type { FriendsService } from "../friends/friends.service";
import type { MaxBotClient } from "../max-bot/max-bot.client";
import { PlaceEntity } from "../places/place.entity";
import { UserEntity } from "../users/user.entity";
import { PlanExpenseEntity } from "./plan-expense.entity";
import { PlanParticipantEntity } from "./plan-participant.entity";
import { PlanEntity } from "./plan.entity";
import { haversineMeters, PlansService, settleBalances } from "./plans.service";

const now = new Date("2026-09-12T10:00:00Z");
const hostId = "00000000-0000-4000-8000-00000000000a";
const dimaId = "00000000-0000-4000-8000-0000000000b1";
const katyaId = "00000000-0000-4000-8000-0000000000b2";
const eventId = "00000000-0000-4000-8000-0000000000e1";
const placeId = "00000000-0000-4000-8000-0000000000p1";
const meetingAt = "2026-09-12T11:00:00.000Z";

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

function createStoreRepo<T extends { id?: string }>(initial: T[] = []) {
  const store = [...initial];
  let seq = 0;
  return {
    store,
    create: (fields: Partial<T>) => ({ ...fields }) as T,
    find: async (opts: { where?: Record<string, string> } = {}) => {
      const where = opts.where ?? {};
      return store.filter((row) => Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value));
    },
    findOneBy: async (where: Record<string, string>) => store.find((row) => Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value)) ?? null,
    save: async (entity: T) => {
      if (!store.includes(entity)) {
        entity.id ??= `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
        (entity as { createdAt?: Date }).createdAt ??= now;
        (entity as { updatedAt?: Date }).updatedAt ??= now;
        store.push(entity);
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
}

function createService() {
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
  const bot = {
    createChat: async () => ({ chatId: 1, link: "https://max.ru/join/plan" }),
    sendMessage: async (_id: string, text: string) => {
      messages.push(text);
      return true;
    },
  } as unknown as MaxBotClient;
  const expenses = createStoreRepo<PlanExpenseEntity>();
  const service = new PlansService(plans as unknown as Repository<PlanEntity>, participants as unknown as Repository<PlanParticipantEntity>, events as unknown as Repository<EventEntity>, places as unknown as Repository<PlaceEntity>, userRepo as unknown as Repository<UserEntity>, expenses as unknown as Repository<PlanExpenseEntity>, friends, bot);
  return { service, messages, plans };
}

describe("haversineMeters", () => {
  it("is zero at the same point and positive otherwise", () => {
    expect(haversineMeters({ latitude: 55.747, longitude: 37.584 }, 55.747, 37.584)).toBe(0);
    expect(haversineMeters({ latitude: 55.75, longitude: 37.62 }, 55.747, 37.584)).toBeGreaterThan(0);
  });
});

describe("PlansService", () => {
  it("creates a plan with invited friends and returns a PlanCard", async () => {
    const { service, messages } = createService();
    const card = await service.create(hostId, {
      eventId,
      participantIds: [dimaId, katyaId],
      meetingPoint: "у метро",
      meetingAt,
    });
    expect(card.event.title).toBe("The Weekend Tribute");
    expect(card.plan.meetingPoint).toBe("у метро");
    expect(card.plan.participants).toHaveLength(2);
    expect(card.plan.participants.every((row) => row.status === "invited")).toBe(true);
    expect(card.distanceMeters).toBe(0);
    expect(messages.some((text) => text.includes("https://max.ru/join/plan"))).toBe(true);
    const withGeo = await service.get(hostId, card.plan.id, { latitude: 55.747, longitude: 37.584 });
    expect(withGeo.distanceMeters).toBe(0);
  });

  it("saves an autoplan draft with travel time, nearby food and dinner→road→meetup→event timeline", async () => {
    const { service, plans } = createService();
    const proposal = await service.generateAutoplan(hostId, eventId, { latitude: 55.75, longitude: 37.62 });
    expect(proposal.travelMinutes).toBeGreaterThanOrEqual(0);
    expect(proposal.foodPlaces.some((row) => row.title === "Депо")).toBe(true);
    expect(proposal.timeline.map((row) => row.label)).toEqual(["ужин", "дорога", "встреча", "событие"]);
    expect(proposal.plan.plan.eventId).toBe(eventId);
    expect(plans.store).toHaveLength(1);
  });

  it("lets an invitee confirm and forbids a stranger", async () => {
    const { service } = createService();
    const created = await service.create(hostId, { eventId, participantIds: [dimaId], meetingPoint: "у метро", meetingAt });
    const confirmed = await service.respond(dimaId, created.plan.id, "confirmed");
    expect(confirmed.plan.participants[0].status).toBe("confirmed");
    await expect(service.get("00000000-0000-4000-8000-0000000000ff", created.plan.id)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects inviting a non-friend and a missing event", async () => {
    const { service } = createService();
    await expect(service.create(hostId, { eventId, participantIds: [hostId], meetingPoint: "у метро", meetingAt })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(hostId, { eventId: "00000000-0000-4000-8000-0000000000e9", participantIds: [dimaId], meetingPoint: "у метро", meetingAt })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("reminds host and invited friends once in the meeting window and skips declined", async () => {
    const { service, messages } = createService();
    const created = await service.create(hostId, { eventId, participantIds: [dimaId, katyaId], meetingPoint: "у метро", meetingAt });
    await service.respond(katyaId, created.plan.id, "declined");
    messages.length = 0;
    const first = await service.remindMeeting(now);
    expect(first.sent).toBe(2);
    expect(messages).toHaveLength(2);
    const second = await service.remindMeeting(now);
    expect(second.sent).toBe(0);
  });

  it("splits expenses and returns per-person totals and debts", async () => {
    const { service } = createService();
    const created = await service.create(hostId, { eventId, participantIds: [dimaId, katyaId], meetingPoint: "у метро", meetingAt });
    await service.respond(dimaId, created.plan.id, "confirmed");
    await service.respond(katyaId, created.plan.id, "confirmed");
    await service.addExpense(hostId, created.plan.id, { title: "Билет", amountRub: 850, payerUserId: hostId, shareUserIds: [hostId, dimaId] });
    await service.addExpense(dimaId, created.plan.id, { title: "Такси", amountRub: 620, payerUserId: dimaId, shareUserIds: [hostId, dimaId] });
    const budget = await service.addExpense(katyaId, created.plan.id, { title: "Ужин", amountRub: 1200, payerUserId: katyaId, shareUserIds: [hostId, dimaId, katyaId] });
    expect(budget.totalRub).toBe(2670);
    const byId = Object.fromEntries(budget.perPerson.map((row) => [row.userId, row]));
    expect(byId[hostId]?.netRub).toBe(-285);
    expect(byId[dimaId]?.netRub).toBe(-515);
    expect(byId[katyaId]?.netRub).toBe(800);
    expect(budget.debts).toEqual([
      { fromUserId: dimaId, toUserId: katyaId, amountRub: 515 },
      { fromUserId: hostId, toUserId: katyaId, amountRub: 285 },
    ]);
    const loaded = await service.getBudget(hostId, created.plan.id);
    expect(loaded.totalRub).toBe(2670);
    await expect(service.addExpense("00000000-0000-4000-8000-0000000000ff", created.plan.id, { title: "Чужой", amountRub: 10, payerUserId: hostId, shareUserIds: [hostId] })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.addExpense(dimaId, created.plan.id, { title: "Чужой", amountRub: 10, payerUserId: hostId, shareUserIds: [hostId] })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.addExpense(hostId, created.plan.id, { title: "Чужой", amountRub: 10, payerUserId: hostId, shareUserIds: [hostId, "00000000-0000-4000-8000-0000000000ff"] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects declined payers and splits a non-divisible amount without losing rubles", async () => {
    const { service } = createService();
    const created = await service.create(hostId, { eventId, participantIds: [dimaId, katyaId], meetingPoint: "у метро", meetingAt });
    await service.respond(dimaId, created.plan.id, "confirmed");
    await service.respond(katyaId, created.plan.id, "declined");
    await expect(service.addExpense(katyaId, created.plan.id, { title: "Ужин", amountRub: 100, payerUserId: katyaId, shareUserIds: [hostId] })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.addExpense(hostId, created.plan.id, { title: "Ужин", amountRub: 100, payerUserId: hostId, shareUserIds: [hostId, katyaId] })).rejects.toBeInstanceOf(BadRequestException);
    await service.respond(katyaId, created.plan.id, "confirmed");
    const budget = await service.addExpense(hostId, created.plan.id, { title: "Кофе", amountRub: 100, payerUserId: hostId, shareUserIds: [hostId, dimaId, katyaId] });
    expect(budget.totalRub).toBe(100);
    expect(budget.perPerson.reduce((sum, row) => sum + row.shareRub, 0)).toBe(100);
    expect(budget.perPerson.reduce((sum, row) => sum + row.netRub, 0)).toBe(0);
    const shares = budget.perPerson.map((row) => row.shareRub).sort((a, b) => b - a);
    expect(shares).toEqual([34, 33, 33]);
  });

  it("spawns the next weekly occurrences from a recurring template", async () => {
    const { service, plans } = createService();
    const created = await service.create(hostId, {
      eventId,
      participantIds: [dimaId],
      meetingPoint: "корт",
      meetingAt: "2026-09-10T19:00:00.000Z",
      recurringRule: { type: "weekly_weekday", weekday: 4 },
    });
    expect(created.plan.id).toBeTruthy();
    expect(plans.store.filter((row) => row.seriesId === created.plan.id).length).toBeGreaterThan(1);
    const copies = plans.store.filter((row) => row.sourcePlanId === created.plan.id);
    expect(copies.length).toBeGreaterThanOrEqual(1);
    expect(copies.every((row) => row.recurringRule === null)).toBe(true);
  });
});

describe("settleBalances", () => {
  it("nets two-sided debts", () => {
    expect(settleBalances(new Map([["a", 100], ["b", -100]]))).toEqual([{ fromUserId: "b", toUserId: "a", amountRub: 100 }]);
  });
});
