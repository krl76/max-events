import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import { CreateEventSchema, type CreateEvent, type Place } from "@max-events/api-contracts";
import { MaxBotClient } from "../max-bot/max-bot.client";
import { PlacesService } from "../places/places.service";
import type { SubscriptionsService } from "../subscriptions/subscriptions.service";
import type { UsersService } from "../users/users.service";
import type { WaitlistService } from "../waitlist/waitlist.service";
import { EventEntity } from "./event.entity";
import { EventsService, toEventDto } from "./events.service";

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
    find: async (opts: { where?: { published?: boolean; city?: string; category?: string }; order?: { startsAt?: "ASC" | "DESC"; id?: "ASC" | "DESC" } }) => {
      let rows = [...store];
      if (opts.where?.published === true) rows = rows.filter((row) => row.published);
      if (opts.where?.city) rows = rows.filter((row) => row.city === opts.where?.city);
      if (opts.where?.category) rows = rows.filter((row) => row.category === opts.where?.category);
      rows.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.id.localeCompare(b.id));
      return rows;
    },
    delete: async (where: { id: string }) => {
      const index = store.findIndex((row) => row.id === where.id);
      if (index < 0) return { affected: 0 };
      store.splice(index, 1);
      return { affected: 1 };
    },
  };
}

function createService(options: { placeIds?: string[]; store?: EventEntity[]; bot?: Pick<MaxBotClient, "createChat">; waitlist?: WaitlistService } = {}) {
  const knownPlaces = new Set(options.placeIds ?? []);
  const places = {
    getById: async (id: string) => {
      if (!knownPlaces.has(id)) throw new NotFoundException("Place not found");
      return { id } as Place;
    },
  } as unknown as PlacesService;
  const repo = createRepo(options.store ?? []);
  const bot = options.bot ?? { createChat: async () => null };
  const subscriptions = { notifyNewEvent: async () => ({ sent: 0, failed: 0 }) } as unknown as SubscriptionsService;
  const users = { assertCanPublish: async () => undefined } as unknown as UsersService;
  const waitlist = options.waitlist ?? ({ fillVacancies: async () => undefined } as unknown as WaitlistService);
  const service = new EventsService(repo as unknown as Repository<EventEntity>, places, bot as MaxBotClient, subscriptions, users, waitlist);
  return { repo, service, waitlist };
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
  it("maps the entity to the api-contracts Event shape with ISO timestamps", () => {
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
      chatLink: null,
      chatSyncPending: true,
      createdAt: new Date("2026-09-01T07:00:00Z"),
      updatedAt: new Date("2026-09-01T07:00:00Z"),
    };
    expect(toEventDto(entity)).toMatchObject({
      id: entity.id,
      title: "Джаз в парке",
      isPaid: false,
      startsAt: "2026-09-12T16:00:00.000Z",
      endsAt: null,
      placeId: null,
    });
  });
});
