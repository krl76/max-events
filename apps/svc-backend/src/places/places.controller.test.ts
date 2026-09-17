import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { CreatePlace, Place } from "@max-events/api-contracts";
import type { UserEntity } from "../users/user.entity";
import { parseListQuery, PlacesController } from "./places.controller";
import type { PlaceListQuery, PlacesService } from "./places.service";

const payload: CreatePlace = {
  title: "Парк Горького",
  address: "ул. Крымский Вал, 9",
  city: "Москва",
  category: "park",
  latitude: 55.7297,
  longitude: 37.6035,
};

const place: Place = {
  id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f",
  ...payload,
  createdAt: "2026-09-01T07:00:00.000Z",
  updatedAt: "2026-09-01T07:00:00.000Z",
};

function createController() {
  const calls: { create?: CreatePlace; list?: PlaceListQuery; getById?: string; update?: { id: string; patch: Partial<CreatePlace> }; remove?: string } = {};
  const service = {
    create: async (body: CreatePlace, _userId?: string) => {
      calls.create = body;
      return place;
    },
    list: async (query: PlaceListQuery): Promise<Place[]> => {
      calls.list = query;
      return [place];
    },
    getById: async (id: string) => {
      calls.getById = id;
      return place;
    },
    update: async (id: string, patch: Partial<CreatePlace>) => {
      calls.update = { id, patch };
      return { ...place, ...patch };
    },
    remove: async (id: string) => {
      calls.remove = id;
    },
  } as unknown as PlacesService;
  return { calls, controller: new PlacesController(service) };
}

const user = { id: "00000000-0000-4000-8000-00000000000a" } as UserEntity;

describe("PlacesController", () => {
  it("rejects an invalid create payload with 400", async () => {
    const { controller } = createController();
    await expect(controller.create(user, { ...payload, title: "" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.create(user, { ...payload, latitude: 95 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates a place from a valid payload", async () => {
    const { calls, controller } = createController();
    await expect(controller.create(user, payload)).resolves.toEqual(place);
    expect(calls.create).toEqual(payload);
  });

  it("passes list filters through to the service", async () => {
    const { calls, controller } = createController();
    const result = await controller.list({ city: "Москва", category: "park", limit: "10", offset: "2" });
    expect(calls.list).toEqual({ city: "Москва", category: "park", limit: 10, offset: 2 });
    expect(result).toEqual([place]);
  });

  it("rejects an invalid list query with 400", () => {
    expect(() => parseListQuery({ category: "ship" })).toThrow(BadRequestException);
    expect(() => parseListQuery({ limit: "0" })).toThrow(BadRequestException);
    expect(() => parseListQuery({ offset: "-1" })).toThrow(BadRequestException);
  });

  it("omits limit when query params are omitted so the map can load every place", () => {
    expect(parseListQuery({})).toEqual({ city: undefined, category: undefined, limit: undefined, offset: 0 });
  });

  it("rejects an invalid patch payload with 400", async () => {
    const { controller } = createController();
    await expect(controller.update(user, place.id, { latitude: 200 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("updates, fetches, and deletes by id", async () => {
    const { calls, controller } = createController();
    await expect(controller.getById(place.id)).resolves.toEqual(place);
    await expect(controller.update(user, place.id, { title: "Новое имя" })).resolves.toMatchObject({ title: "Новое имя" });
    await controller.remove(user, place.id);
    expect(calls.getById).toBe(place.id);
    expect(calls.update).toEqual({ id: place.id, patch: { title: "Новое имя" } });
    expect(calls.remove).toBe(place.id);
  });
});
