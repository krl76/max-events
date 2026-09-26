import { describe, expect, it } from "vitest";
import type { Event, WheretoQuery } from "@max-events/api-contracts";
import type { EventListQuery, EventsService } from "../events/events.service";
import { selectWheretoItems, WheretoService } from "./whereto.service";

const now = new Date("2026-09-12T10:00:00Z");

function event(overrides: Partial<Event> & Pick<Event, "id" | "title" | "category">): Event {
  return {
    description: "",
    city: "Москва",
    placeId: null,
    startsAt: "2026-09-20T16:00:00.000Z",
    endsAt: null,
    isPaid: false,
    priceRub: null,
    paymentUrl: null,
    capacity: null,
    chatLink: null,
    promoted: false,
    published: true,
    bookingOpensAt: null,
    weather: null,
    coverUrl: null,
    ...overrides,
  };
}

const catalog: Event[] = [
  event({ id: "00000000-0000-4000-8000-0000000000e1", title: "Джаз", category: "afisha", startsAt: "2026-09-22T18:00:00.000Z" }),
  event({ id: "00000000-0000-4000-8000-0000000000e2", title: "Пробежка", category: "sport", startsAt: "2026-09-18T06:00:00.000Z" }),
  event({ id: "00000000-0000-4000-8000-0000000000e3", title: "Прогулка", category: "tourism", startsAt: "2026-09-19T10:00:00.000Z" }),
  event({ id: "00000000-0000-4000-8000-0000000000e4", title: "Субботник", category: "volunteering", startsAt: "2026-09-17T08:00:00.000Z" }),
  event({
    id: "00000000-0000-4000-8000-0000000000e5",
    title: "Платный джаз",
    category: "afisha",
    startsAt: "2026-09-21T18:00:00.000Z",
    isPaid: true,
    priceRub: 1500,
    paymentUrl: "https://tickets.example.com/jazz",
  }),
  event({
    id: "00000000-0000-4000-8000-0000000000e6",
    title: "Дорогой концерт",
    category: "afisha",
    startsAt: "2026-09-16T18:00:00.000Z",
    isPaid: true,
    priceRub: 5000,
    paymentUrl: "https://tickets.example.com/concert",
  }),
  event({ id: "00000000-0000-4000-8000-0000000000e7", title: "Ещё спорт", category: "sport", startsAt: "2026-09-23T06:00:00.000Z" }),
  event({ id: "00000000-0000-4000-8000-0000000000e8", title: "Ещё туризм", category: "tourism", startsAt: "2026-09-24T10:00:00.000Z" }),
  event({ id: "00000000-0000-4000-8000-0000000000e9", title: "Скалодром", category: "sport", startsAt: "2026-09-25T09:00:00.000Z" }),
];

function query(overrides: Partial<WheretoQuery> = {}): WheretoQuery {
  return { company: "alone", mood: "active", budget: "any", ...overrides };
}

describe("selectWheretoItems", () => {
  it("maps mood to categories, sorts by start, and caps at 5", () => {
    const active = selectWheretoItems(catalog, query({ mood: "active" }));
    expect(active.map((item) => item.title)).toEqual(["Пробежка", "Прогулка", "Ещё спорт", "Ещё туризм", "Скалодром"]);
    expect(selectWheretoItems(catalog, query({ mood: "calm" })).map((item) => item.category)).toEqual(["afisha", "afisha", "afisha"]);
  });

  it("filters free and under_3000 budgets", () => {
    const free = selectWheretoItems(catalog, query({ mood: "calm", budget: "free" }));
    expect(free.map((item) => item.title)).toEqual(["Джаз"]);
    const cheap = selectWheretoItems(catalog, query({ mood: "calm", budget: "under_3000" }));
    expect(cheap.map((item) => item.title)).toEqual(["Платный джаз", "Джаз"]);
  });

  it("applies company constraints for partner and kids", () => {
    const partner = selectWheretoItems(catalog, query({ mood: "unusual", company: "partner" }));
    expect(partner.every((item) => item.category !== "volunteering")).toBe(true);
    const kids = selectWheretoItems(catalog, query({ mood: "calm", company: "kids", budget: "any" }));
    expect(kids.map((item) => item.title)).not.toContain("Дорогой концерт");
  });
});

describe("WheretoService", () => {
  it("asks EventsService for published events from now and returns the filtered cap", async () => {
    const calls: EventListQuery[] = [];
    const events = {
      list: async (listQuery: EventListQuery) => {
        calls.push(listQuery);
        return catalog;
      },
    } as unknown as EventsService;
    const profiles = { getOrCreate: async () => ({ interests: [] }) } as never;
    const service = new WheretoService(events, profiles);
    const result = await service.suggest(query({ mood: "active" }), undefined, now);
    expect(calls).toEqual([{ dateFrom: now, viewerId: undefined }]);
    expect(result.items).toHaveLength(5);
    expect(result.items[0].title).toBe("Пробежка");
  });
});
