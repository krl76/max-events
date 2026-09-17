import { ConflictException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { DataSource, EntityManager, Repository } from "typeorm";
import { PlaceEntity } from "../places/place.entity";
import type { UsersService } from "../users/users.service";
import { MicroEventEntity, MicroEventParticipantEntity } from "./micro-event.entity";
import { MicroEventsService } from "./micro-events.service";

const now = new Date("2026-09-12T19:00:00Z");
const author = "00000000-0000-4000-8000-00000000000a";
const other = "00000000-0000-4000-8000-00000000000b";
const third = "00000000-0000-4000-8000-00000000000c";

function createStoreRepo<T extends { id?: string }>(initial: T[] = []) {
  const store = [...initial];
  let seq = 0;
  return {
    store,
    create: (fields: Partial<T>) => ({ ...fields }) as T,
    find: async (opts: { where?: Record<string, unknown> } = {}) => {
      const where = opts.where ?? {};
      return store.filter((row) => Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value));
    },
    findOneBy: async (where: Record<string, string>) => store.find((row) => Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value)) ?? null,
    countBy: async (where: Record<string, string>) => store.filter((row) => Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value)).length,
    save: async (entity: T) => {
      if (!store.includes(entity)) {
        entity.id ??= `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
        (entity as { createdAt?: Date }).createdAt ??= now;
        store.push(entity);
      }
      return entity;
    },
    delete: async (where: { id: string }) => {
      const index = store.findIndex((row) => row.id === where.id);
      if (index >= 0) store.splice(index, 1);
    },
  };
}

function createService() {
  const events = createStoreRepo<MicroEventEntity>();
  const participants = createStoreRepo<MicroEventParticipantEntity>();
  const places = createStoreRepo<PlaceEntity>();
  const users = { assertCanPublish: async () => undefined } as unknown as UsersService;
  const dataSource = {
    transaction: async <T>(run: (em: EntityManager) => Promise<T>) => {
      const manager = {
        findOne: async (entity: unknown, options: { where: Record<string, string> }) => {
          if (entity === MicroEventEntity) return events.store.find((row) => row.id === options.where.id) ?? null;
          return participants.store.find((row) => row.microEventId === options.where.microEventId && row.userId === options.where.userId) ?? null;
        },
        count: async () => participants.store.filter((row) => row.microEventId === events.store[0]?.id).length,
        create: (_e: unknown, fields: Partial<MicroEventParticipantEntity>) => ({ ...fields }) as MicroEventParticipantEntity,
        save: async (_e: unknown, row: MicroEventParticipantEntity) => participants.save(row),
      };
      return run(manager as unknown as EntityManager);
    },
  } as unknown as DataSource;
  const service = new MicroEventsService(dataSource, events as unknown as Repository<MicroEventEntity>, participants as unknown as Repository<MicroEventParticipantEntity>, places as unknown as Repository<PlaceEntity>, users);
  return { service, participants };
}

describe("MicroEventsService", () => {
  it("creates a published micro-event, auto-joins the author, and reports 1/limit", async () => {
    const { service } = createService();
    const created = await service.create(author, { title: "Баскетбол", startsAt: now.toISOString(), locationText: "школьный двор", participantsLimit: 6 });
    expect(created.participantsCount).toBe(1);
    expect(created.participantsLimit).toBe(6);
    expect(created.status).toBe("open");
    const listed = await service.list();
    expect(listed).toHaveLength(1);
  });

  it("enforces the participant limit on join", async () => {
    const { service } = createService();
    const created = await service.create(author, { title: "Баскетбол", startsAt: now.toISOString(), locationText: "двор", participantsLimit: 2 });
    await service.join(other, created.id);
    await expect(service.join(third, created.id)).rejects.toBeInstanceOf(ConflictException);
  });

  it("lets a participant leave and frees the seat", async () => {
    const { service } = createService();
    const created = await service.create(author, { title: "Баскетбол", startsAt: now.toISOString(), locationText: "двор", participantsLimit: 2 });
    await service.join(other, created.id);
    const left = await service.leave(other, created.id);
    expect(left.participantsCount).toBe(1);
    await expect(service.leave(other, created.id)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
