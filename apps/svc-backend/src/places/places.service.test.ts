import { ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { QueryFailedError, type Repository } from "typeorm";
import type { CreatePlace } from "@max-events/api-contracts";
import type { UsersService } from "../users/users.service";
import { PlaceEntity } from "./place.entity";
import { PlacesService, toPlaceDto } from "./places.service";

const payload: CreatePlace = {
  title: "Парк Горького",
  address: "ул. Крымский Вал, 9",
  city: "Москва",
  category: "park",
  latitude: 55.7297,
  longitude: 37.6035,
};

function uniqueViolation(): QueryFailedError {
  return new QueryFailedError("INSERT", [], Object.assign(new Error("duplicate key value"), { code: "23505" }));
}

function keyOf(place: Pick<PlaceEntity, "title" | "address" | "city">) {
  return `${place.title}|${place.address}|${place.city}`;
}

function createRepo(initial: PlaceEntity[] = []) {
  const store: PlaceEntity[] = [...initial];
  let seq = 0;
  const nextId = () => {
    seq += 1;
    return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
  };
  const now = () => new Date("2026-09-01T07:00:00Z");

  return {
    store,
    create: (fields: Partial<PlaceEntity>) => ({ ...fields }) as PlaceEntity,
    merge: (target: PlaceEntity, fields: Partial<PlaceEntity>) => Object.assign(target, fields),
    save: async (entity: PlaceEntity) => {
      const duplicate = store.some((row) => row !== entity && keyOf(row) === keyOf(entity));
      if (duplicate) throw uniqueViolation();
      if (!store.includes(entity)) {
        entity.id ??= nextId();
        entity.createdAt ??= now();
        entity.updatedAt ??= now();
        store.push(entity);
      } else {
        entity.updatedAt = now();
      }
      return entity;
    },
    findOneBy: async (where: { id: string }) => store.find((row) => row.id === where.id) ?? null,
    find: async (opts: { where?: { published?: boolean; city?: string; category?: string }; skip?: number; take?: number; order?: { title?: "ASC" | "DESC"; id?: "ASC" | "DESC" } }) => {
      let rows = [...store];
      if (opts.where?.published === true) rows = rows.filter((row) => row.published !== false);
      if (opts.where?.city) rows = rows.filter((row) => row.city === opts.where?.city);
      if (opts.where?.category) rows = rows.filter((row) => row.category === opts.where?.category);
      rows.sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
      const skip = opts.skip ?? 0;
      const take = opts.take ?? rows.length - skip;
      return rows.slice(skip, skip + take);
    },
    delete: async (where: { id: string }) => {
      const index = store.findIndex((row) => row.id === where.id);
      if (index < 0) return { affected: 0 };
      store.splice(index, 1);
      return { affected: 1 };
    },
  };
}

function createService(store: PlaceEntity[] = []) {
  const repo = createRepo(store);
  const users = { assertCanPublish: async () => undefined } as unknown as UsersService;
  const service = new PlacesService(repo as unknown as Repository<PlaceEntity>, users);
  return { repo, service };
}

describe("PlacesService", () => {
  it("creates a place and maps it to the Place contract", async () => {
    const { repo, service } = createService();
    const created = await service.create(payload);
    expect(repo.store).toHaveLength(1);
    expect(created.title).toBe("Парк Горького");
    expect(created.category).toBe("park");
    expect(created.latitude).toBe(55.7297);
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.createdAt).toBe("2026-09-01T07:00:00.000Z");
  });

  it("rejects a duplicate title+address+city", async () => {
    const { service } = createService();
    await service.create(payload);
    await expect(service.create(payload)).rejects.toBeInstanceOf(ConflictException);
  });

  it("returns 404 for a missing id on get, update, and delete", async () => {
    const { service } = createService();
    const missing = "00000000-0000-4000-8000-000000000099";
    await expect(service.getById(missing)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update(missing, { title: "Other" })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove(missing)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("updates allowed fields of an existing place", async () => {
    const { service } = createService();
    const created = await service.create(payload);
    const updated = await service.update(created.id, { title: "Парк Горького (новое)" });
    expect(updated.id).toBe(created.id);
    expect(updated.title).toBe("Парк Горького (новое)");
    expect(updated.city).toBe("Москва");
  });

  it("deletes an existing place", async () => {
    const { repo, service } = createService();
    const created = await service.create(payload);
    await service.remove(created.id);
    expect(repo.store).toHaveLength(0);
  });

  it("filters the list by city and by category", async () => {
    const { service } = createService();
    await service.create(payload);
    await service.create({ ...payload, title: "Эрмитаж", address: "Дворцовая наб., 34", city: "Санкт-Петербург", category: "museum" });
    await service.create({ ...payload, title: "Лужники", address: "ул. Лужники, 24", category: "sport" });

    const moscow = await service.list({ city: "Москва", offset: 0 });
    expect(moscow.map((item) => item.title)).toEqual(["Лужники", "Парк Горького"]);

    const museums = await service.list({ category: "museum", offset: 0 });
    expect(museums).toHaveLength(1);
    expect(museums[0]?.title).toBe("Эрмитаж");
  });

  it("paginates with limit and offset", async () => {
    const { service } = createService();
    await service.create(payload);
    await service.create({ ...payload, title: "Аптекарский огород", address: "просп. Мира, 26" });
    await service.create({ ...payload, title: "ВДНХ", address: "просп. Мира, 119" });

    const page = await service.list({ city: "Москва", limit: 2, offset: 1 });
    expect(page).toHaveLength(2);
    expect(page.map((item) => item.title)).toEqual(["ВДНХ", "Парк Горького"]);
  });

  it("rethrows driver errors other than a unique violation", async () => {
    const repo = createRepo();
    const boom = new QueryFailedError("INSERT", [], Object.assign(new Error("connection lost"), { code: "08006" }));
    repo.save = async () => {
      throw boom;
    };
    const service = new PlacesService(repo as unknown as Repository<PlaceEntity>, { assertCanPublish: async () => undefined } as unknown as UsersService);
    await expect(service.create(payload)).rejects.toBe(boom);
  });
});

describe("toPlaceDto", () => {
  it("maps the entity to the api-contracts Place shape with ISO timestamps", () => {
    const entity: PlaceEntity = {
      id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f",
      title: "Парк Горького",
      address: "ул. Крымский Вал, 9",
      city: "Москва",
      category: "park",
      latitude: 55.7297,
      longitude: 37.6035,
      published: true,
      createdAt: new Date("2026-09-01T07:00:00Z"),
      updatedAt: new Date("2026-09-01T07:00:00Z"),
    };
    expect(toPlaceDto(entity)).toEqual({
      id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f",
      title: "Парк Горького",
      address: "ул. Крымский Вал, 9",
      city: "Москва",
      category: "park",
      latitude: 55.7297,
      longitude: 37.6035,
      createdAt: "2026-09-01T07:00:00.000Z",
      updatedAt: "2026-09-01T07:00:00.000Z",
    });
  });
});
