import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { QueryFailedError, type Repository } from "typeorm";
import type { Friend } from "@max-events/api-contracts";
import { EventEntity } from "../events/event.entity";
import type { FriendsService } from "../friends/friends.service";
import type { MaxBotClient } from "../max-bot/max-bot.client";
import { PlaceEntity } from "../places/place.entity";
import { UserEntity } from "../users/user.entity";
import { PlanExpenseEntity } from "./plan-expense.entity";
import { PlanParticipantEntity } from "./plan-participant.entity";
import { PlanEntity } from "./plan.entity";
import { formatPlanPollText, haversineMeters, PlansService, settleBalances } from "./plans.service";

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
  return { service, messages, plans, participants };
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

  it("spawns four weekly copies then treats a second spawn as a no-op", async () => {
    const { service, plans, participants } = createService();
    const created = await service.create(hostId, {
      eventId,
      participantIds: [dimaId],
      meetingPoint: "корт",
      meetingAt: "2026-09-10T16:00:00.000Z",
      recurringRule: { type: "weekly_weekday", weekday: 4 },
    });
    const copies = plans.store.filter((row) => row.sourcePlanId === created.plan.id);
    expect(copies).toHaveLength(4);
    expect(copies.map((row) => row.meetingAt.toISOString()).sort()).toEqual([
      new Date("2026-09-17T19:00:00+03:00").toISOString(),
      new Date("2026-09-24T19:00:00+03:00").toISOString(),
      new Date("2026-10-01T19:00:00+03:00").toISOString(),
      new Date("2026-10-08T19:00:00+03:00").toISOString(),
    ]);
    expect(copies.every((row) => row.recurringRule === null && row.sourcePlanId === created.plan.id)).toBe(true);
    for (const copy of copies) {
      const rows = participants.store.filter((row) => row.planId === copy.id);
      expect(rows.map((row) => row.userId)).toEqual([dimaId]);
      expect(rows.every((row) => row.status === "invited")).toBe(true);
    }
    expect(plans.store.filter((row) => row.seriesId === created.plan.id)).toHaveLength(5);
    const second = await service.spawnRecurring(new Date("2026-09-10T16:00:00.000Z"));
    expect(second).toBe(0);
    expect(plans.store.filter((row) => row.seriesId === created.plan.id)).toHaveLength(5);
  });

  it("spawns four monthly first-Saturday copies", async () => {
    const { service, plans } = createService();
    const created = await service.create(hostId, {
      eventId,
      participantIds: [dimaId],
      meetingPoint: "парк",
      meetingAt: "2026-09-05T08:00:00.000Z",
      recurringRule: { type: "monthly_nth_weekday", nth: 1, weekday: 6 },
    });
    const copies = plans.store.filter((row) => row.sourcePlanId === created.plan.id);
    expect(copies.map((row) => row.meetingAt.toISOString()).sort()).toEqual([
      new Date("2026-10-03T11:00:00+03:00").toISOString(),
      new Date("2026-11-07T11:00:00+03:00").toISOString(),
      new Date("2026-12-05T11:00:00+03:00").toISOString(),
      new Date("2027-01-02T11:00:00+03:00").toISOString(),
    ]);
  });

  it("omits a declined friend from later spawned copies", async () => {
    const { service, plans, participants } = createService();
    const created = await service.create(hostId, {
      eventId,
      participantIds: [dimaId, katyaId],
      meetingPoint: "корт",
      meetingAt: "2026-09-10T16:00:00.000Z",
      recurringRule: { type: "weekly_weekday", weekday: 4 },
    });
    await service.respond(katyaId, created.plan.id, "declined");
    const added = await service.spawnRecurring(new Date("2026-10-08T16:00:00.000Z"));
    expect(added).toBe(4);
    const later = plans.store.filter((row) => row.sourcePlanId === created.plan.id && row.meetingAt.getTime() > Date.parse("2026-10-08T16:00:00.000Z"));
    expect(later).toHaveLength(4);
    for (const copy of later) {
      const rows = participants.store.filter((row) => row.planId === copy.id);
      expect(rows.map((row) => row.userId)).toEqual([dimaId]);
    }
  });

  it("does not recreate a cancelled occurrence", async () => {
    const { service, plans } = createService();
    const created = await service.create(hostId, {
      eventId,
      participantIds: [dimaId],
      meetingPoint: "корт",
      meetingAt: "2026-09-10T16:00:00.000Z",
      recurringRule: { type: "weekly_weekday", weekday: 4 },
    });
    const copies = plans.store.filter((row) => row.sourcePlanId === created.plan.id);
    const victim = copies[0]!;
    await service.remove(hostId, victim.id);
    expect(victim.cancelledAt).toBeInstanceOf(Date);
    expect(await service.spawnRecurring(new Date("2026-09-10T16:00:00.000Z"))).toBe(0);
    expect(plans.store.filter((row) => row.sourcePlanId === created.plan.id && row.meetingAt.getTime() === victim.meetingAt.getTime())).toHaveLength(1);
    const listed = await service.list(hostId);
    expect(listed.some((card) => card.plan.id === victim.id)).toBe(false);
    await expect(service.get(hostId, victim.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("retries a slot after a participant write fails and keeps other series moving", async () => {
    const { service, plans, participants } = createService();
    const created = await service.create(hostId, {
      eventId,
      participantIds: [dimaId],
      meetingPoint: "корт",
      meetingAt: "2026-09-10T16:00:00.000Z",
      recurringRule: { type: "weekly_weekday", weekday: 4 },
    });
    for (const copy of plans.store.filter((row) => row.sourcePlanId === created.plan.id)) {
      for (const row of participants.store.filter((item) => item.planId === copy.id)) await participants.delete({ id: row.id });
      await plans.delete({ id: copy.id });
    }
    const broken = await plans.save(
      plans.create({
        hostUserId: hostId,
        eventId,
        meetingPoint: "корт",
        meetingAt: new Date("2026-09-10T16:00:00.000Z"),
        chatLink: null,
        reminderSentAt: null,
        leaveNowSentAt: null,
        weatherAlertSentAt: null,
        friendLeftBroadcastAt: null,
        recurringRule: { type: "weekly_weekday", weekday: 99 as 1 },
        seriesId: "00000000-0000-4000-8000-00000000bad1",
        sourcePlanId: null,
        cancelledAt: null,
      }),
    );
    broken.seriesId = broken.id;
    await plans.save(broken);
    const originalSave = participants.save.bind(participants);
    participants.save = async () => {
      throw new Error("participant write failed");
    };
    expect(await service.spawnRecurring(new Date("2026-09-10T16:00:00.000Z"))).toBe(0);
    expect(plans.store.filter((row) => row.sourcePlanId === created.plan.id)).toHaveLength(0);
    participants.save = originalSave;
    expect(await service.spawnRecurring(new Date("2026-09-10T16:00:00.000Z"))).toBe(4);
    const recovered = plans.store.filter((row) => row.sourcePlanId === created.plan.id);
    expect(recovered).toHaveLength(4);
    expect(recovered.every((row) => participants.store.some((item) => item.planId === row.id && item.userId === dimaId))).toBe(true);
  });

  it("spawns four future Thursdays from a nine-year-old weekly template", async () => {
    const { service, plans, participants } = createService();
    const template = await plans.save(
      plans.create({
        hostUserId: hostId,
        eventId,
        meetingPoint: "корт",
        meetingAt: new Date("2017-09-07T19:00:00+03:00"),
        chatLink: null,
        reminderSentAt: null,
        leaveNowSentAt: null,
        weatherAlertSentAt: null,
        friendLeftBroadcastAt: null,
        recurringRule: { type: "weekly_weekday", weekday: 4 },
        seriesId: null,
        sourcePlanId: null,
        cancelledAt: null,
      }),
    );
    template.seriesId = template.id;
    await plans.save(template);
    await participants.save(participants.create({ planId: template.id, userId: dimaId, status: "invited", reminderSentAt: null, leaveNowSentAt: null, friendLeftBroadcastAt: null, pollSentAt: null }));
    const after = new Date("2026-09-12T10:00:00.000Z");
    expect(await service.spawnRecurring(after)).toBe(4);
    const copies = plans.store.filter((row) => row.sourcePlanId === template.id);
    const times = copies.map((row) => row.meetingAt.toISOString()).sort();
    expect(times).toEqual([
      new Date("2026-09-17T19:00:00+03:00").toISOString(),
      new Date("2026-09-24T19:00:00+03:00").toISOString(),
      new Date("2026-10-01T19:00:00+03:00").toISOString(),
      new Date("2026-10-08T19:00:00+03:00").toISOString(),
    ]);
    expect(new Set(times).size).toBe(4);
    expect(copies.every((row) => row.meetingAt.getTime() > after.getTime())).toBe(true);
  });

  it("polls invited friends on a copy inside the 7-day window once and records their respond status", async () => {
    const { service, plans, messages } = createService();
    const created = await service.create(hostId, {
      eventId,
      participantIds: [dimaId],
      meetingPoint: "корт",
      meetingAt: "2026-09-10T16:00:00.000Z",
      recurringRule: { type: "weekly_weekday", weekday: 4 },
    });
    const first = plans.store.filter((row) => row.sourcePlanId === created.plan.id).sort((a, b) => a.meetingAt.getTime() - b.meetingAt.getTime())[0]!;
    expect(formatPlanPollText("The Weekend Tribute", "корт", first.meetingAt)).toContain("Идёшь на четверг?");
    messages.length = 0;
    const firstPoll = await service.pollRecurring(now);
    expect(firstPoll.sent).toBe(1);
    expect(messages).toEqual([formatPlanPollText("The Weekend Tribute", "корт", first.meetingAt)]);
    expect(await service.pollRecurring(now)).toEqual({ sent: 0, failed: 0 });
    const answered = await service.respond(dimaId, first.id, "confirmed");
    expect(answered.plan.participants).toEqual([{ friend: { id: dimaId, name: "Дима", avatarUrl: null }, status: "confirmed" }]);
    expect(await service.pollRecurring(new Date("2026-09-01T00:00:00.000Z"))).toEqual({ sent: 0, failed: 0 });
  });

  it("skips declined and cancelled copies when polling", async () => {
    const { service, plans, messages } = createService();
    const created = await service.create(hostId, {
      eventId,
      participantIds: [dimaId, katyaId],
      meetingPoint: "корт",
      meetingAt: "2026-09-10T16:00:00.000Z",
      recurringRule: { type: "weekly_weekday", weekday: 4 },
    });
    const copies = plans.store.filter((row) => row.sourcePlanId === created.plan.id).sort((a, b) => a.meetingAt.getTime() - b.meetingAt.getTime());
    const first = copies[0]!;
    await service.respond(katyaId, first.id, "declined");
    messages.length = 0;
    expect(await service.pollRecurring(now)).toEqual({ sent: 1, failed: 0 });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("Идёшь на четверг?");
    await service.remove(hostId, first.id);
    messages.length = 0;
    expect(await service.pollRecurring(now)).toEqual({ sent: 0, failed: 0 });
    expect(messages).toHaveLength(0);
  });
});

describe("settleBalances", () => {
  it("nets two-sided debts", () => {
    expect(settleBalances(new Map([["a", 100], ["b", -100]]))).toEqual([{ fromUserId: "b", toUserId: "a", amountRub: 100 }]);
  });
});
