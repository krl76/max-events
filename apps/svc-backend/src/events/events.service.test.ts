import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { FindOperator, Repository } from "typeorm";
import { CreateEventSchema, type CreateEvent, type Place } from "@max-events/api-contracts";
import { MaxBotClient } from "../max-bot/max-bot.client";
import { PlacesService } from "../places/places.service";
import type { SubscriptionsService } from "../subscriptions/subscriptions.service";
import type { UsersService } from "../users/users.service";
import type { PromotionService } from "../promotion/promotion.service";
import type { WaitlistService } from "../waitlist/waitlist.service";
import { EventEntity } from "./event.entity";
import { EVENT_LIST_MAX_LIMIT, EventsService, toEventDto } from "./events.service";

const placeId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f";

const payload: CreateEvent = CreateEventSchema.parse({
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
    find: async (opts: { where?: { published?: boolean; city?: string; category?: string; organizerUserId?: string; startsAt?: FindOperator<Date>; chatSyncPending?: boolean; chatLink?: FindOperator<string> }; order?: { startsAt?: "ASC" | "DESC"; id?: "ASC" | "DESC"; createdAt?: "ASC" | "DESC" }; skip?: number; take?: number }) => {
      let rows = [...store];
      if (opts.where?.published === true) rows = rows.filter((row) => row.published);
      if (opts.where?.city) rows = rows.filter((row) => row.city === opts.where?.city);
      if (opts.where?.category) rows = rows.filter((row) => row.category === opts.where?.category);
      if (opts.where?.organizerUserId) rows = rows.filter((row) => row.organizerUserId === opts.where?.organizerUserId);
      if (opts.where?.chatSyncPending !== undefined) rows = rows.filter((row) => row.chatSyncPending === opts.where?.chatSyncPending);
      if (opts.where?.chatLink?.type === "isNull") rows = rows.filter((row) => row.chatLink === null);
      const startsAt = opts.where?.startsAt;
      if (startsAt) rows = rows.filter((row) => matchesDateOperator(row.startsAt, startsAt));
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

// The catalog list now pushes its start window into the WHERE clause, so the fake repository has to
// read the same find operators postgres would.
function matchesDateOperator(value: Date, operator: FindOperator<Date>): boolean {
  if (operator.type === "and") return (operator.value as unknown as FindOperator<Date>[]).every((inner) => matchesDateOperator(value, inner));
  const bound = operator.value as unknown as Date;
  if (operator.type === "moreThanOrEqual") return value.getTime() >= bound.getTime();
  if (operator.type === "lessThan") return value.getTime() < bound.getTime();
  if (operator.type === "lessThanOrEqual") return value.getTime() <= bound.getTime();
  throw new Error(`unsupported find operator in fake repository: ${operator.type}`);
}

function createService(options: { placeIds?: string[]; draftPlaceIds?: string[]; ownerId?: string; store?: EventEntity[]; bot?: Pick<MaxBotClient, "createChat">; waitlist?: WaitlistService; banned?: boolean; promotions?: PromotionService } = {}) {
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
  } as unknown as UsersService;
  const waitlist = options.waitlist ?? ({ fillVacancies: async () => undefined } as unknown as WaitlistService);
  const promotions = options.promotions ?? ({ listActive: async () => [], promotedEventIds: async () => new Set<string>() } as unknown as PromotionService);
  const service = new EventsService(repo as unknown as Repository<EventEntity>, places, bot as MaxBotClient, subscriptions, users, waitlist, promotions);
  return { repo, service, waitlist, chatCalls, notifyCalls };
}

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

  it("caps a limit above the hard ceiling instead of reading the whole table", async () => {
    const { service } = createService();
    await service.create(payload);
    // The ceiling is what protects the query; asking past it must not widen the read.
    await expect(service.list({ limit: EVENT_LIST_MAX_LIMIT + 50 })).resolves.toHaveLength(1);
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
