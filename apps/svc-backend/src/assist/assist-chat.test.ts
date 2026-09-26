import { beforeEach, describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import type { PlanCard } from "@max-events/api-contracts";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import { FriendshipEntity } from "../friends/friendship.entity";
import { ListItemEntity } from "../lists/list-item.entity";
import { ListEntity } from "../lists/list.entity";
import type { PlansService } from "../plans/plans.service";
import { AssistService } from "./assist.service";
import { LlmProviderError, type LlmProvider } from "./llm-provider";
import { AssistRateLimiter } from "./rate-limit";

const userId = "00000000-0000-4000-8000-00000000000a";
const partnerId = "00000000-0000-4000-8000-00000000000b";
const jazzId = "00000000-0000-4000-8000-0000000000e1";
const savedId = "00000000-0000-4000-8000-0000000000e2";
const now = new Date("2026-09-12T10:00:00Z");

const calls: string[] = [];

const defaultChatTurn: LlmProvider["chatTurn"] = async (message: string) => {
  calls.push(message);
  return { refuse: false, reply: "Могу подобрать событие на вечер.", eventIds: [], openEventId: null, plan: false, criteria: null };
};

const provider: LlmProvider = {
  parseQuery: async () => {
    throw new Error("unused");
  },
  chatTurn: defaultChatTurn,
};

function eventRow(id: string, title: string, startsAt: string, priceRub: number | null, category: EventEntity["category"] = "afisha"): EventEntity {
  return {
    id,
    title,
    description: title,
    category,
    city: "Москва",
    placeId: null,
    startsAt: new Date(startsAt),
    endsAt: null,
    isPaid: priceRub !== null,
    priceRub,
    paymentUrl: priceRub ? "https://pay.example" : null,
    capacity: null,
    bookedCount: 0,
    published: true,
    chatLink: null,
    chatSyncPending: false,
    createdAt: now,
    updatedAt: now,
  } as EventEntity;
}

function createService() {
  const events = [eventRow(jazzId, "Вечер джаза", "2026-09-19T19:00:00+03:00", 1800), eventRow(savedId, "Концерт камерной музыки", "2026-09-20T20:00:00+03:00", 900), eventRow("00000000-0000-4000-8000-0000000000e3", "Субботник", "2026-09-20T19:00:00+03:00", null, "volunteering"), eventRow("00000000-0000-4000-8000-0000000000e4", "Дорогой концерт", "2026-09-19T19:00:00+03:00", 5000)];
  const checkIns = [{ userId, eventId: jazzId, placeId: null } as CheckInEntity];
  const friendships = [{ userId, friendUserId: partnerId, id: "f1", createdAt: now } as FriendshipEntity];
  const lists = [{ id: "list-1", userId: partnerId } as ListEntity];
  const listItems = [{ listId: "list-1", eventId: savedId } as ListItemEntity];
  const plansStore: PlanCard[] = [];
  let planSeq = 0;
  const plans = {
    findExisting: async (_hostUserId: string, eventId: string, meetingAt: Date) => plansStore.find((card) => card.plan.eventId === eventId && new Date(card.plan.meetingAt).getTime() === meetingAt.getTime()) ?? null,
    create: async (_hostUserId: string, payload: { eventId: string; meetingPoint: string; meetingAt: string }) => {
      planSeq += 1;
      const card = { plan: { id: `00000000-0000-4000-8000-${String(planSeq).padStart(12, "0")}`, eventId: payload.eventId, participants: [], meetingPoint: payload.meetingPoint, meetingAt: payload.meetingAt, createdAt: now.toISOString(), updatedAt: now.toISOString() }, event: { id: payload.eventId }, distanceMeters: 0 } as unknown as PlanCard;
      plansStore.push(card);
      return card;
    },
  } as unknown as PlansService;
  const service = new AssistService(provider, { find: async () => events } as unknown as Repository<EventEntity>, { find: async () => checkIns } as unknown as Repository<CheckInEntity>, { find: async () => friendships } as unknown as Repository<FriendshipEntity>, { find: async () => lists } as unknown as Repository<ListEntity>, { find: async () => listItems } as unknown as Repository<ListItemEntity>, plans, new AssistRateLimiter());
  return { service, events, plansStore };
}

describe("AssistService.chat", () => {
  beforeEach(() => {
    calls.length = 0;
    provider.chatTurn = defaultChatTurn;
  });

  it("stays silent on an insult and does not call the model", async () => {
    const { service } = createService();
    await expect(service.chat(userId, { message: "иди на хуй", transcript: [], offeredEventIds: [] }, now)).resolves.toEqual({ silence: true, fallback: false });
    expect(calls).toEqual([]);
  });

  it("opens the second offered card without the model", async () => {
    const { service } = createService();
    const result = await service.chat(userId, { message: "берём второй", transcript: [], offeredEventIds: [jazzId, savedId] }, now);
    expect(result.openEventId).toBe(savedId);
    expect(result.reply).toBe("Открываю «Концерт камерной музыки».");
    expect(calls).toEqual([]);
  });

  it("returns the model reply for small talk", async () => {
    const { service } = createService();
    const result = await service.chat(userId, { message: "как дела?", transcript: [], offeredEventIds: [] }, now);
    expect(result.reply).toBe("Могу подобрать событие на вечер.");
    expect(result.items).toBeUndefined();
    expect(result.fallback).toBe(false);
  });

  it("drops an event id the model invented", async () => {
    provider.chatTurn = async () => ({ refuse: false, reply: "Вот.", eventIds: ["00000000-0000-4000-8000-000000000099", jazzId], openEventId: null, plan: false, criteria: null });
    const { service } = createService();
    const result = await service.chat(userId, { message: "вечером музыка", transcript: [], offeredEventIds: [] }, now);
    expect(result.items?.map((pick) => pick.event.id)).toEqual([jazzId]);
    expect(result.items?.[0]?.explanation).toBe("Подходит по запросу");
  });

  it("uses the keyword poster when every model fails", async () => {
    provider.chatTurn = async () => {
      throw new LlmProviderError("llm_network", "LLM request failed");
    };
    const { service } = createService();
    const music = await service.chat(userId, { message: "вечером музыка", transcript: [], offeredEventIds: [] }, now);
    expect(music.fallback).toBe(true);
    expect(music.reply).toBe("Не получилось сформировать ответ. Подобрал по словам запроса.");
    expect(music.items?.length).toBeGreaterThan(0);
    const hello = await service.chat(userId, { message: "как дела?", transcript: [], offeredEventIds: [] }, now);
    expect(hello.reply).toBe("Не получилось сформировать ответ. Вот что есть в афише.");
    expect(hello.items?.length).toBeGreaterThan(0);
    expect(hello.items?.length).toBeLessThanOrEqual(4);
  });
});
