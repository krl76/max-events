import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import { FriendshipEntity } from "../friends/friendship.entity";
import { ListItemEntity } from "../lists/list-item.entity";
import { ListEntity } from "../lists/list.entity";
import { AssistService, formatAssistSummary } from "./assist.service";
import { NoneLlmProvider } from "./none-llm.provider";
import { SandboxLlmProvider } from "./sandbox-llm.provider";

const userId = "00000000-0000-4000-8000-00000000000a";
const partnerId = "00000000-0000-4000-8000-00000000000b";
const jazzId = "00000000-0000-4000-8000-0000000000e1";
const savedId = "00000000-0000-4000-8000-0000000000e2";
const now = new Date("2026-09-12T10:00:00Z");

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
  const events = [
    eventRow(jazzId, "Вечер джаза", "2026-09-19T19:00:00+03:00", 1800),
    eventRow(savedId, "Концерт камерной музыки", "2026-09-20T20:00:00+03:00", 900),
    eventRow("00000000-0000-4000-8000-0000000000e3", "Субботник", "2026-09-20T19:00:00+03:00", null, "volunteering"),
    eventRow("00000000-0000-4000-8000-0000000000e4", "Дорогой концерт", "2026-09-19T19:00:00+03:00", 5000),
  ];
  const checkIns = [{ userId, eventId: jazzId, placeId: null } as CheckInEntity];
  const friendships = [{ userId, friendUserId: partnerId, id: "f1", createdAt: now } as FriendshipEntity];
  const lists = [{ id: "list-1", userId: partnerId } as ListEntity];
  const listItems = [{ listId: "list-1", eventId: savedId } as ListItemEntity];
  const service = new AssistService(
    new SandboxLlmProvider(),
    { find: async () => events } as unknown as Repository<EventEntity>,
    { find: async () => checkIns } as unknown as Repository<CheckInEntity>,
    { find: async () => friendships } as unknown as Repository<FriendshipEntity>,
    { find: async () => lists } as unknown as Repository<ListEntity>,
    { find: async () => listItems } as unknown as Repository<ListItemEntity>,
  );
  return service;
}

describe("AssistService", () => {
  it("returns a README-style pick with personal explanations", async () => {
    const service = createService();
    const result = await service.suggest(userId, "Хочу вечером куда-нибудь, максимум 3000 ₽, с девушкой, желательно музыка", now);
    expect(result.criteria).toEqual({ when: "evening", budgetMaxRub: 3000, company: "partner", genre: "music" });
    expect(result.items.map((row) => row.event.id).sort()).toEqual([jazzId, savedId].sort());
    expect(result.summary).toContain("по твоей истории");
    expect(result.summary).toContain("уже сохранила твоя девушка");
    expect(result.items.find((row) => row.event.id === jazzId)?.explanation).toContain("истории");
    expect(result.items.find((row) => row.event.id === savedId)?.explanation).toContain("девушк");
    expect(formatAssistSummary(7, 2, 1)).toBe("Нашел 7 вариантов, 2 по твоей истории, 1 уже сохранила твоя девушка");
  });

  it("fails closed when the LLM provider is disabled", async () => {
    const service = new AssistService(new NoneLlmProvider(), { find: async () => [] } as never, { find: async () => [] } as never, { find: async () => [] } as never, { find: async () => [] } as never, { find: async () => [] } as never);
    await expect(service.suggest(userId, "что угодно")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
