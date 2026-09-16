import { NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import type { ParticipationStatus } from "@max-events/api-contracts";
import { EventEntity } from "../events/event.entity";
import { ParticipationEntity } from "./participation.entity";
import { ParticipationsService } from "./participations.service";

const now = new Date("2026-09-01T07:00:00Z");
const userId = "00000000-0000-4000-8000-00000000000a";
const otherUserId = "00000000-0000-4000-8000-00000000000b";
const eventId = "00000000-0000-4000-8000-0000000000e1";
const missingEventId = "00000000-0000-4000-8000-0000000000e9";

function createParticipationRepo(initial: ParticipationEntity[] = []) {
  const store = [...initial];
  let seq = 0;
  return {
    store,
    create: (fields: Partial<ParticipationEntity>) => ({ ...fields }) as ParticipationEntity,
    findOneBy: async (where: { userId?: string; eventId?: string; id?: string }) =>
      store.find((row) => {
        if (where.id) return row.id === where.id;
        return row.userId === where.userId && row.eventId === where.eventId;
      }) ?? null,
    find: async (opts: { where?: { eventId?: string } }) => store.filter((row) => !opts.where?.eventId || row.eventId === opts.where.eventId),
    save: async (entity: ParticipationEntity) => {
      if (!store.includes(entity)) {
        entity.id ??= `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
        entity.createdAt ??= now;
        entity.updatedAt ??= now;
        store.push(entity);
      } else {
        entity.updatedAt = now;
      }
      return entity;
    },
    delete: async (where: { id: string }) => {
      const index = store.findIndex((row) => row.id === where.id);
      if (index < 0) return { affected: 0 };
      store.splice(index, 1);
      return { affected: 1 };
    },
  };
}

function createEventRepo() {
  const event = { id: eventId } as EventEntity;
  return {
    findOneBy: async (where: { id: string }) => (where.id === eventId ? event : null),
  };
}

function createService(initial: ParticipationEntity[] = []) {
  const participations = createParticipationRepo(initial);
  const events = createEventRepo();
  const service = new ParticipationsService(
    participations as unknown as Repository<ParticipationEntity>,
    events as unknown as Repository<EventEntity>,
  );
  return { participations, service };
}

describe("ParticipationsService", () => {
  it("sets a status, replaces it on the same row, and does not duplicate", async () => {
    const { participations, service } = createService();
    const first = await service.set(userId, eventId, "wants_to_go");
    expect(first.status).toBe("wants_to_go");
    expect(participations.store).toHaveLength(1);

    const second = await service.set(userId, eventId, "going");
    expect(second.id).toBe(first.id);
    expect(second.status).toBe("going");
    expect(participations.store).toHaveLength(1);
  });

  it("counts every status and reports only the current user's myStatus", async () => {
    const { service } = createService();
    await service.set(userId, eventId, "going");
    await service.set(otherUserId, eventId, "looking_for_company");
    await service.set("00000000-0000-4000-8000-00000000000c", eventId, "looking_for_company");

    const stats = await service.stats(userId, eventId);
    expect(stats.counts.going).toBe(1);
    expect(stats.counts.looking_for_company).toBe(2);
    expect(stats.counts.wants_to_go).toBe(0);
    expect(stats.friendsCount).toBe(0);
    expect(stats.myStatus).toBe("going");
    const statuses: ParticipationStatus[] = [
      "wants_to_go",
      "probably_going",
      "going",
      "looking_for_company",
      "looking_for_travel_buddy",
      "looking_for_after_event_company",
    ];
    for (const status of statuses) expect(stats.counts[status]).toBeGreaterThanOrEqual(0);
  });

  it("clears myStatus after delete and 404s a second delete", async () => {
    const { participations, service } = createService();
    const created = await service.set(userId, eventId, "probably_going");
    await expect(service.getMine(userId, eventId)).resolves.toMatchObject({ id: created.id, status: "probably_going" });

    const removed = await service.remove(userId, eventId);
    expect(removed.id).toBe(created.id);
    expect(participations.store).toHaveLength(0);
    await expect(service.stats(userId, eventId)).resolves.toMatchObject({ myStatus: null, friendsCount: 0 });
    await expect(service.remove(userId, eventId)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getMine(userId, eventId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("returns 404 when the event is missing", async () => {
    const { service } = createService();
    await expect(service.set(userId, missingEventId, "going")).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.stats(userId, missingEventId)).rejects.toBeInstanceOf(NotFoundException);
  });
});
