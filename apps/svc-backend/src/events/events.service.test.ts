import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { CreateEventSchema, type Event } from "@max-events/api-contracts";
import type { PromotionService } from "../promotion/promotion.service";
import type { WaitlistService } from "../waitlist/waitlist.service";
import { EventEntity } from "./event.entity";
import type { EventWeatherService } from "./event-weather.service";
import { EVENT_LIST_MAX_LIMIT, categoryHintFromQuery, toEventDto } from "./events.service";
import { createService, farPlaceId, payload, placeId } from "./events.service.testHarness";

describe("EventsService", () => {
  it("creates a free event and maps it to the Event contract", async () => {
    const { repo, service } = createService();
    const created = await service.create(payload);
    expect(repo.store).toHaveLength(1);
    expect(created.title).toBe("Джаз в парке");
    expect(created.isPaid).toBe(false);
    expect(created.paymentUrl).toBeNull();
    expect(created.placeId).toBeNull();
    expect(created.startsAt).toBe("2026-09-12T16:00:00.000Z");
    expect(created.chatLink).toBeNull();
    expect(repo.store[0]?.chatSyncPending).toBe(true);
  });

  it("stores a chat invite link when the bot succeeds and keeps the event if the bot fails", async () => {
    const ok = createService({ bot: { createChat: async () => ({ chatId: 7, link: "https://max.ru/join/abc" }) } });
    const withChat = await ok.service.create(payload);
    expect(withChat.chatLink).toBe("https://max.ru/join/abc");
    expect(ok.repo.store[0]?.chatSyncPending).toBe(false);

    const down = createService({
      bot: {
        createChat: async () => {
          throw new Error("bot down");
        },
      },
    });
    const fallback = await down.service.create(CreateEventSchema.parse({ ...payload, title: "Без чата" }));
    expect(fallback.title).toBe("Без чата");
    expect(fallback.chatLink).toBeNull();
    expect(down.repo.store[0]?.chatSyncPending).toBe(true);
  });

  it("retries the pending chat on the next sync pass and clears the flag", async () => {
    const down = createService({
      bot: {
        createChat: async () => {
          throw new Error("bot down");
        },
      },
    });
    await down.service.create(payload);
    expect(down.repo.store[0]?.chatSyncPending).toBe(true);

    // The retry runs against the same rows once the Bot API is reachable again.
    const back = createService({ store: down.repo.store, bot: { createChat: async () => ({ chatId: 7, link: "https://max.ru/join/late" }) } });
    await expect(back.service.syncPendingChats()).resolves.toBe(1);
    expect(back.repo.store[0]?.chatLink).toBe("https://max.ru/join/late");
    expect(back.repo.store[0]?.chatSyncPending).toBe(false);
    // Nothing is pending any more, so a second pass is a no-op.
    await expect(back.service.syncPendingChats()).resolves.toBe(0);
  });

  it("leaves the flag set when the bot is still down", async () => {
    const down = createService({
      bot: {
        createChat: async () => {
          throw new Error("bot down");
        },
      },
    });
    await down.service.create(payload);
    await expect(down.service.syncPendingChats()).resolves.toBe(0);
    expect(down.repo.store[0]?.chatSyncPending).toBe(true);
    expect(down.repo.store[0]?.chatLink).toBeNull();
  });

  it("stores a paid event with a payment link and rejects an unknown placeId", async () => {
    const { service } = createService({ placeIds: [placeId] });
    const paid = await service.create(
      CreateEventSchema.parse({
        ...payload,
        isPaid: true,
        priceRub: 1500,
        paymentUrl: "https://organizer.example.com/pay",
        placeId,
      }),
    );
    expect(paid.isPaid).toBe(true);
    expect(paid.paymentUrl).toBe("https://organizer.example.com/pay");
    expect(paid.placeId).toBe(placeId);

    await expect(service.create(CreateEventSchema.parse({ ...payload, title: "Other", placeId: "00000000-0000-4000-8000-000000000099" }))).rejects.toBeInstanceOf(BadRequestException);
  });

  it("returns 404 for a missing id on get, update, and delete", async () => {
    const { service } = createService();
    const missing = "00000000-0000-4000-8000-000000000099";
    await expect(service.getById(missing)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update(missing, { title: "Other" })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove(missing)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects endsAt before startsAt and a paymentUrl on a free event", async () => {
    const { service } = createService();
    await expect(service.create(CreateEventSchema.parse({ ...payload, endsAt: "2026-09-12T10:00:00+03:00" }))).rejects.toBeInstanceOf(BadRequestException);
    const created = await service.create(payload);
    await expect(service.update(created.id, { paymentUrl: "https://organizer.example.com/pay" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("updates allowed fields and deletes an event", async () => {
    const { repo, service } = createService();
    const created = await service.create(payload);
    const updated = await service.update(created.id, { title: "Джаз в саду", city: "Казань" });
    expect(updated.id).toBe(created.id);
    expect(updated.title).toBe("Джаз в саду");
    expect(updated.city).toBe("Казань");
    await service.remove(created.id);
    expect(repo.store).toHaveLength(0);
  });

  it("filters the catalog by city, category, and calendar date and sorts by startsAt", async () => {
    const { service } = createService();
    await service.create(CreateEventSchema.parse({ ...payload, title: "Позже", startsAt: "2026-09-20T19:00:00+03:00" }));
    await service.create(payload);
    await service.create(CreateEventSchema.parse({ ...payload, title: "Субботник", category: "volunteering", city: "Казань", startsAt: "2026-09-12T12:00:00+03:00" }));

    const moscow = await service.list({ city: "Москва" });
    expect(moscow.map((item) => item.title)).toEqual(["Джаз в парке", "Позже"]);

    const volunteering = await service.list({ category: "volunteering" });
    expect(volunteering).toHaveLength(1);
    expect(volunteering[0]?.title).toBe("Субботник");

    const onDay = await service.list({ date: "2026-09-12" });
    expect(onDay.map((item) => item.title)).toEqual(["Субботник", "Джаз в парке"]);
  });

  it("filters the catalog by a case-insensitive title or description needle", async () => {
    const { service } = createService();
    await service.create(payload);
    await service.create(CreateEventSchema.parse({ ...payload, title: "Позже", description: "вечер на набережной", startsAt: "2026-09-20T19:00:00+03:00" }));
    expect((await service.list({ q: "ДЖАЗ" })).map((item) => item.title)).toEqual(["Джаз в парке"]);
    expect((await service.list({ q: "набережной" })).map((item) => item.title)).toEqual(["Позже"]);
    expect(await service.list({ q: "несуществующий запрос 42" })).toEqual([]);
    expect(await service.list({ q: "%%%" })).toEqual([]);
  });

  it("orders the catalog by rating and by distance when asked", async () => {
    const { repo, service: writer } = createService({ placeIds: [placeId, farPlaceId] });
    const jazz = await writer.create(CreateEventSchema.parse({ ...payload, placeId, startsAt: "2026-09-12T19:00:00+03:00" }));
    const later = await writer.create(CreateEventSchema.parse({ ...payload, title: "Позже", placeId: farPlaceId, startsAt: "2026-09-20T19:00:00+03:00" }));
    await writer.create(CreateEventSchema.parse({ ...payload, title: "Без отзывов", startsAt: "2026-09-13T19:00:00+03:00" }));
    const rated = createService({ store: repo.store, placeIds: [placeId, farPlaceId], averages: { [jazz.id]: 3, [later.id]: 5 } }).service;
    expect((await rated.list({ sort: "rating" })).map((item) => item.title)).toEqual(["Позже", "Джаз в парке", "Без отзывов"]);
    const plain = repo.store.find((row) => row.title === "Без отзывов");
    if (plain) plain.popularity = 8000;
    expect((await rated.list({ sort: "rating" })).map((item) => item.title)).toEqual(["Без отзывов", "Позже", "Джаз в парке"]);
    expect((await rated.list({ sort: "soon" })).map((item) => item.title)).toEqual(["Джаз в парке", "Без отзывов", "Позже"]);
    expect((await rated.list({ sort: "near", latitude: 56.75, longitude: 37.62 })).map((item) => item.title)).toEqual(["Позже", "Джаз в парке", "Без отзывов"]);
    const boosted = createService({
      store: repo.store,
      placeIds: [placeId, farPlaceId],
      promotions: {
        listActive: async () => [{ eventId: later.id }],
        promotedEventIds: async () => new Set([later.id]),
      } as unknown as PromotionService,
    }).service;
    expect((await boosted.list({ sort: "near" })).map((item) => item.title)).toEqual(["Джаз в парке", "Без отзывов", "Позже"]);
  });

  it("reads only the requested page of the catalog", async () => {
    const { repo, service } = createService();
    for (const day of ["13", "14", "15"]) {
      await service.create(CreateEventSchema.parse({ ...payload, title: `День ${day}`, startsAt: `2026-09-${day}T19:00:00+03:00` }));
    }
    const firstPage = await service.list({ limit: 2 });
    expect(firstPage.map((item) => item.title)).toEqual(["День 13", "День 14"]);
    const secondPage = await service.list({ limit: 2, offset: 2 });
    expect(secondPage.map((item) => item.title)).toEqual(["День 15"]);
    expect(repo.store).toHaveLength(3);
  });

  it("keeps the rating filter in the query, so a page is a page of matches", async () => {
    const { repo, service } = createService();
    for (const day of ["13", "14", "15"]) {
      await service.create(CreateEventSchema.parse({ ...payload, title: `День ${day}`, startsAt: `2026-09-${day}T19:00:00+03:00` }));
    }
    const [first, , third] = repo.store;
    const rated = createService({ store: repo.store, ratedIds: { 4: [first!.id, third!.id] } }).service;

    // Post-filtering a page would have returned one row here and made limit lie about the rest.
    const page = await rated.list({ minRating: 4, limit: 2 });

    expect(page.map((item) => item.title)).toEqual(["День 13", "День 15"]);
  });

  it("finds nothing when no event reaches the asked-for rating", async () => {
    const { repo, service } = createService();
    await service.create(payload);
    const rated = createService({ store: repo.store, ratedIds: {} }).service;

    // An event nobody reviewed has no average, so it is not "at least five stars" — it is unrated.
    await expect(rated.list({ minRating: 5 })).resolves.toEqual([]);
  });

  it("caps a limit above the hard ceiling instead of reading the whole table", async () => {
    const { service } = createService();
    await service.create(payload);
    // The ceiling is what protects the query; asking past it must not widen the read.
    await expect(service.list({ limit: EVENT_LIST_MAX_LIMIT + 50 })).resolves.toHaveLength(1);
  });

  it("attaches weather snapshots from EventWeatherService on the catalog list", async () => {
    const snapshot = { temperatureC: 12, condition: "ясно", conditionCode: 0, precipitationProbability: 0 };
    const { service } = createService({
      weather: { attach: async (events: Event[]) => events.map((row) => ({ ...row, weather: snapshot })) } as unknown as EventWeatherService,
    });
    await service.create(payload);
    expect((await service.list({}))[0]?.weather).toEqual(snapshot);
  });

  it("lifts a boosted event to the front of the catalog and marks it promoted", async () => {
    const { repo, service: writer } = createService();
    await writer.create(payload);
    await writer.create(CreateEventSchema.parse({ ...payload, title: "Позже", startsAt: "2026-09-20T19:00:00+03:00" }));
    const later = repo.store.find((row) => row.title === "Позже")!;
    const { service } = createService({
      store: repo.store,
      promotions: {
        listActive: async () => [{ eventId: later.id }],
        promotedEventIds: async () => new Set([later.id]),
      } as unknown as PromotionService,
    });
    const listed = await service.list({ city: "Москва" });
    expect(listed.map((item) => item.title)).toEqual(["Позже", "Джаз в парке"]);
    expect(listed[0]?.promoted).toBe(true);
    expect(listed[1]?.promoted).toBe(false);
  });

  it("hides drafts from the catalog and forbids a non-organizer from editing", async () => {
    const { repo, service, chatCalls, notifyCalls } = createService({ bot: { createChat: async () => ({ chatId: 7, link: "https://max.ru/join/draft" }) } });
    const organizer = "00000000-0000-4000-8000-00000000000a";
    const draft = await service.create(payload, organizer, { draft: true });
    expect(repo.store[0]?.published).toBe(false);
    expect(draft.published).toBe(false);
    expect(chatCalls).toEqual([]);
    expect(notifyCalls).toEqual([]);
    expect(await service.list({})).toEqual([]);
    await expect(service.update(draft.id, { title: "Чужой" }, "00000000-0000-4000-8000-00000000000b")).rejects.toBeInstanceOf(ForbiddenException);
    const published = await service.publish(draft.id, organizer);
    expect(published.title).toBe("Джаз в парке");
    expect(published.published).toBe(true);
    expect(published.chatLink).toBe("https://max.ru/join/draft");
    expect(chatCalls).toEqual([payload.title]);
    expect(notifyCalls).toEqual([draft.id]);
    expect((await service.listMine(organizer)).map((row) => row.id)).toEqual([draft.id]);
  });

  it("binds create and listMine to the organization id the organizer panel passes", async () => {
    const orgId = "00000000-0000-4000-8000-0000000000c1";
    const userId = "00000000-0000-4000-8000-00000000000a";
    const otherOrg = "00000000-0000-4000-8000-0000000000c2";
    const { repo, service } = createService({ organization: { id: orgId, organizerUserId: userId } });
    const created = await service.create(payload, orgId, { draft: true });
    expect(repo.store[0]?.organizerOrganizationId).toBe(orgId);
    expect(repo.store[0]?.organizerUserId).toBe(userId);
    expect((await service.listMine(orgId)).map((row) => row.id)).toEqual([created.id]);
    expect(await service.listMine(otherOrg)).toEqual([]);
  });

  it("lets an organizer bind their own unpublished place and blocks a banned publisher", async () => {
    const organizer = "00000000-0000-4000-8000-00000000000a";
    const { service } = createService({ draftPlaceIds: [placeId], ownerId: organizer });
    await expect(service.create(CreateEventSchema.parse({ ...payload, placeId }), organizer)).rejects.toBeInstanceOf(BadRequestException);
    const draft = await service.create(CreateEventSchema.parse({ ...payload, placeId }), organizer, { draft: true });
    expect(draft.placeId).toBe(placeId);
    await expect(service.publish(draft.id, organizer)).rejects.toBeInstanceOf(BadRequestException);
    const banned = createService({ banned: true });
    await expect(banned.service.publish(draft.id, organizer)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("fills waitlist vacancies when capacity increases", async () => {
    const calls: string[] = [];
    const { service } = createService({
      waitlist: {
        fillVacancies: async (id: string) => {
          calls.push(id);
        },
      } as unknown as WaitlistService,
    });
    const created = await service.create(CreateEventSchema.parse({ ...payload, capacity: 1 }));
    await service.update(created.id, { capacity: 3 });
    expect(calls).toEqual([created.id]);
  });

  it("filters by date_from/date_to and hides unpublished events", async () => {
    const { repo, service } = createService();
    await service.create(payload);
    await service.create(CreateEventSchema.parse({ ...payload, title: "Позже", startsAt: "2026-09-20T19:00:00+03:00" }));
    const range = await service.list({ dateFrom: new Date("2026-09-19T00:00:00.000Z") });
    expect(range.map((item) => item.title)).toEqual(["Позже"]);

    repo.store[0].published = false;
    const listed = await service.list({});
    expect(listed.map((item) => item.title)).toEqual(["Позже"]);
  });

  it("boosts catalog rows that match the viewer's interests without hiding the rest", async () => {
    const { service } = createService({ interests: ["джаз"] });
    await service.create(CreateEventSchema.parse({ ...payload, title: "Пробежка", startsAt: "2026-09-12T18:00:00+03:00" }));
    await service.create(CreateEventSchema.parse({ ...payload, title: "Вечер джаза", startsAt: "2026-09-13T19:00:00+03:00" }));
    const titles = (await service.list({ viewerId: "00000000-0000-4000-8000-00000000000a" })).map((item) => item.title);
    expect(titles[0]).toBe("Вечер джаза");
    expect(titles).toContain("Пробежка");
  });

  it("wraps the catalog as search cards with distance, rating and the venue line", async () => {
    const { repo, service: writer } = createService({ placeIds: [placeId] });
    const jazz = await writer.create(CreateEventSchema.parse({ ...payload, placeId }));
    await writer.create(CreateEventSchema.parse({ ...payload, title: "Без площадки", startsAt: "2026-09-13T19:00:00+03:00" }));
    const cards = await createService({
      store: repo.store,
      placeIds: [placeId],
      averages: { [jazz.id]: 4.8 },
    }).service.listCards({ latitude: 55.75, longitude: 37.62, viewerId: "00000000-0000-4000-8000-00000000000a" });
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({ distanceKm: 0, rating: 4.8, placeTitle: "Площадка" });
    expect(cards[0]?.event.id).toBe(jazz.id);
    expect(cards[1]).toMatchObject({ distanceKm: null, rating: null, placeTitle: null });
  });

  it("leaves distance null when the caller names no origin", async () => {
    const { service } = createService({ placeIds: [placeId] });
    await service.create(CreateEventSchema.parse({ ...payload, placeId }));
    const [card] = await service.listCards({ viewerId: "00000000-0000-4000-8000-00000000000a" });
    expect(card?.distanceKm).toBeNull();
    expect(card?.placeTitle).toBe("Площадка");
  });

  it("treats Спорт as the sport category, not only as letters inside a title", () => {
    expect(categoryHintFromQuery("Спорт")).toBe("sport");
    expect(categoryHintFromQuery("Волонтерство")).toBe("volunteering");
    expect(categoryHintFromQuery("джаз")).toBeNull();
    expect(categoryHintFromQuery("куда сходить")).toBeNull();
  });
});

describe("toEventDto", () => {
  const entity: EventEntity = {
    id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f",
    title: "Джаз в парке",
    description: "",
    category: "afisha",
    city: "Москва",
    placeId: null,
    organizerUserId: null,
    startsAt: new Date("2026-09-12T16:00:00Z"),
    endsAt: null,
    isPaid: false,
    priceRub: null,
    paymentUrl: null,
    capacity: null,
    bookedCount: 0,
    published: true,
    bookingOpensAt: null,
    chatLink: null,
    chatSyncPending: true,
    createdAt: new Date("2026-09-01T07:00:00Z"),
    updatedAt: new Date("2026-09-01T07:00:00Z"),
  };
  it("maps the entity to the api-contracts Event shape with ISO timestamps", () => {
    expect(toEventDto(entity)).toMatchObject({
      id: entity.id,
      title: "Джаз в парке",
      isPaid: false,
      startsAt: "2026-09-12T16:00:00.000Z",
      endsAt: null,
      placeId: null,
      published: true,
      bookingOpensAt: null,
      weather: null,
    });
    expect(toEventDto({ ...entity, published: false }).published).toBe(false);
  });

  it("exposes the early-access bookingOpensAt window as ISO or null", () => {
    const base = toEventDto({ ...entity, bookingOpensAt: null });
    expect(base.bookingOpensAt).toBeNull();
    const opens = new Date("2026-09-20T06:00:00Z");
    expect(toEventDto({ ...entity, bookingOpensAt: opens }).bookingOpensAt).toBe("2026-09-20T06:00:00.000Z");
  });
});
