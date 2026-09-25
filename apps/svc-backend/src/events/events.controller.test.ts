import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { CreateEventSchema, type CreateEvent, type Event } from "@max-events/api-contracts";
import { UserEntity } from "../users/user.entity";
import { parseEventListQuery, EventsController } from "./events.controller";
import type { EventDetailsService } from "./event-details.service";
import type { EventListQuery, EventsService } from "./events.service";

const payload: CreateEvent = CreateEventSchema.parse({
  title: "Джаз в парке",
  category: "afisha",
  city: "Москва",
  startsAt: "2026-09-12T19:00:00+03:00",
});

const user = { id: "00000000-0000-4000-8000-00000000000a" } as UserEntity;

const event: Event = {
  id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f",
  ...payload,
  chatLink: null,
  promoted: false,
  published: true,
  bookingOpensAt: null,
  weather: null,
  coverUrl: null,
};

function createController() {
  const calls: { create?: CreateEvent; list?: EventListQuery; getById?: string; details?: { id: string; viewerId: string }; update?: { id: string; patch: Record<string, unknown> }; remove?: string } = {};
  const service = {
    create: async (body: CreateEvent) => {
      calls.create = body;
      return event;
    },
    list: async (query: EventListQuery): Promise<Event[]> => {
      calls.list = query;
      return [event];
    },
    getById: async (id: string) => {
      calls.getById = id;
      return event;
    },
    update: async (id: string, patch: Record<string, unknown>) => {
      calls.update = { id, patch };
      return { ...event, ...patch };
    },
    remove: async (id: string) => {
      calls.remove = id;
    },
  } as unknown as EventsService;
  const details = {
    get: async (id: string, viewerId: string) => {
      calls.details = { id, viewerId };
      return { event };
    },
  } as unknown as EventDetailsService;
  return { calls, controller: new EventsController(service, details) };
}

describe("EventsController", () => {
  it("rejects an invalid create payload with 400", async () => {
    const { controller } = createController();
    await expect(controller.create(user, { ...payload, title: "" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.create(user, { ...payload, isPaid: true })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates an event from a valid payload", async () => {
    const { calls, controller } = createController();
    await expect(controller.create(user, payload)).resolves.toEqual(event);
    expect(calls.create).toEqual(payload);
  });

  it("passes catalog filters through to the service", async () => {
    const { calls, controller } = createController();
    const result = await controller.list(user, { city: "Москва", category: "afisha", date: "2026-09-12", date_from: "2026-09-01T00:00:00.000Z" });
    expect(calls.list).toMatchObject({
      city: "Москва",
      category: "afisha",
      date: "2026-09-12",
      dateFrom: new Date("2026-09-01T00:00:00.000Z"),
      viewerId: user.id,
    });
    expect(result).toEqual([event]);
  });

  it("rejects an invalid list query with 400", () => {
    expect(() => parseEventListQuery({ category: "park" })).toThrow(BadRequestException);
    expect(() => parseEventListQuery({ date: "12-09-2026" })).toThrow(BadRequestException);
    expect(() => parseEventListQuery({ date_from: "yesterday" })).toThrow(BadRequestException);
    expect(() => parseEventListQuery({ limit: "0" })).toThrow(BadRequestException);
    expect(() => parseEventListQuery({ limit: "1000" })).toThrow(BadRequestException);
    expect(() => parseEventListQuery({ offset: "-1" })).toThrow(BadRequestException);
    expect(() => parseEventListQuery({ min_rating: "0" })).toThrow(BadRequestException);
    expect(() => parseEventListQuery({ min_rating: "6" })).toThrow(BadRequestException);
    expect(() => parseEventListQuery({ min_rating: "4.5" })).toThrow(BadRequestException);
    expect(() => parseEventListQuery({ min_rating: "четыре" })).toThrow(BadRequestException);
    expect(() => parseEventListQuery({ sort: "popular" })).toThrow(BadRequestException);
    expect(() => parseEventListQuery({ q: "x".repeat(201) })).toThrow(BadRequestException);
  });

  it("passes a valid page window through to the service", () => {
    expect(parseEventListQuery({ limit: "20", offset: "40" })).toMatchObject({ limit: 20, offset: 40 });
  });

  it("passes the rating threshold through, and leaves it unset when absent", () => {
    expect(parseEventListQuery({ min_rating: "4" })).toMatchObject({ minRating: 4 });
    expect(parseEventListQuery({ lat: "55.75", lng: "37.62" })).toMatchObject({ latitude: 55.75, longitude: 37.62 });
    expect(() => parseEventListQuery({ lat: "55.75" })).toThrow(BadRequestException);
    expect(() => parseEventListQuery({ lat: "91", lng: "37" })).toThrow(BadRequestException);
    expect(parseEventListQuery({}).minRating).toBeUndefined();
    expect(parseEventListQuery({ min_rating: "" }).minRating).toBeUndefined();
    expect(parseEventListQuery({ q: "  джаз  ", sort: "near" })).toMatchObject({ q: "джаз", sort: "near" });
    expect(parseEventListQuery({ q: "" }).q).toBeUndefined();
    expect(parseEventListQuery({ sort: "soon" }).sort).toBe("soon");
  });

  it("serves the details aggregate for the current user", async () => {
    const { calls, controller } = createController();
    await expect(controller.getDetails(user, event.id)).resolves.toEqual({ event });
    expect(calls.details).toEqual({ id: event.id, viewerId: user.id });
  });

  it("updates, fetches, and deletes by id", async () => {
    const { calls, controller } = createController();
    await expect(controller.getById(event.id)).resolves.toEqual(event);
    await expect(controller.update(user, event.id, { title: "Новое имя" })).resolves.toMatchObject({ title: "Новое имя" });
    await expect(controller.update(user, event.id, "nope")).rejects.toBeInstanceOf(BadRequestException);
    await controller.remove(user, event.id);
    expect(calls.getById).toBe(event.id);
    expect(calls.update).toEqual({ id: event.id, patch: { title: "Новое имя" } });
    expect(calls.remove).toBe(event.id);
  });
});
