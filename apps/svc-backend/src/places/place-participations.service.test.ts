import { NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import type { PlacesService } from "./places.service";
import { PlaceParticipationEntity } from "./place-participation.entity";
import { PlaceParticipationsService } from "./place-participations.service";

const placeId = "00000000-0000-4000-8000-0000000000a1";
const userId = "00000000-0000-4000-8000-00000000000a";

function createService(opts: { missing?: boolean } = {}) {
  const store: PlaceParticipationEntity[] = [];
  const rows = {
    store,
    findOneBy: async (where: { userId: string; placeId: string }) => store.find((row) => row.userId === where.userId && row.placeId === where.placeId) ?? null,
    create: (fields: Partial<PlaceParticipationEntity>) => ({ ...fields }) as PlaceParticipationEntity,
    save: async (entity: PlaceParticipationEntity) => {
      if (!store.includes(entity)) {
        entity.id ??= "00000000-0000-4000-8000-0000000000p1";
        store.push(entity);
      }
      return entity;
    },
    remove: async (entity: PlaceParticipationEntity) => {
      const index = store.indexOf(entity);
      if (index >= 0) store.splice(index, 1);
      return entity;
    },
  };
  const places = {
    getById: async (id: string) => {
      if (opts.missing || id !== placeId) throw new NotFoundException("Place not found");
      return { id };
    },
  } as unknown as PlacesService;
  return { service: new PlaceParticipationsService(rows as unknown as Repository<PlaceParticipationEntity>, places), store };
}

describe("PlaceParticipationsService", () => {
  it("writes, replaces and clears a venue status", async () => {
    const { service, store } = createService();
    await expect(service.set(userId, placeId, "going")).resolves.toEqual({ placeId, status: "going" });
    expect(store).toHaveLength(1);
    await expect(service.set(userId, placeId, "wants_to_go")).resolves.toEqual({ placeId, status: "wants_to_go" });
    expect(store[0]?.status).toBe("wants_to_go");
    await expect(service.set(userId, placeId, null)).resolves.toEqual({ placeId, status: null });
    expect(store).toHaveLength(0);
  });

  it("404s an unpublished or missing place", async () => {
    const { service } = createService({ missing: true });
    await expect(service.set(userId, placeId, "going")).rejects.toBeInstanceOf(NotFoundException);
  });
});
