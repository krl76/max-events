import { ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { QueryFailedError, type Repository } from "typeorm";
import type { EventEntity } from "../events/event.entity";
import type { FeedPostEntity } from "../feed/feed-post.entity";
import type { MicroEventEntity } from "../microevents/micro-event.entity";
import type { PlaceEntity } from "../places/place.entity";
import { ReportEntity } from "./report.entity";
import { ReportsService } from "./reports.service";

const now = new Date("2026-09-12T10:00:00Z");
const userId = "00000000-0000-4000-8000-00000000000a";
const eventId = "00000000-0000-4000-8000-0000000000e1";
const placeId = "00000000-0000-4000-8000-0000000000a1";
const feedPostId = "00000000-0000-4000-8000-0000000000f1";
const microEventId = "00000000-0000-4000-8000-0000000000c1";
const missingId = "00000000-0000-4000-8000-0000000000e9";

function createStoreRepo() {
  const store: ReportEntity[] = [];
  let seq = 0;
  return {
    store,
    create: (fields: Partial<ReportEntity>) => ({ ...fields, createdAt: now }) as ReportEntity,
    find: async (opts: { where?: { status?: string } } = {}) => store.filter((row) => !opts.where?.status || row.status === opts.where.status),
    findOneBy: async (where: { id: string }) => store.find((row) => row.id === where.id) ?? null,
    save: async (entity: ReportEntity) => {
      const dup = store.find((row) => row !== entity && row.userId === entity.userId && row.targetType === entity.targetType && row.targetId === entity.targetId);
      if (dup) throw new QueryFailedError("INSERT", [], Object.assign(new Error("duplicate"), { code: "23505" }));
      if (!store.includes(entity)) {
        entity.id ??= `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
        store.push(entity);
      }
      return entity;
    },
  };
}

// Only the ids seeded here exist; every other id must read as a missing target.
function createService(repo: ReturnType<typeof createStoreRepo>) {
  const known = (id: string) => ({ findOneBy: async (where: { id: string }) => (where.id === id ? ({ id } as { id: string }) : null) });
  return new ReportsService(repo as unknown as Repository<ReportEntity>, known(eventId) as unknown as Repository<EventEntity>, known(placeId) as unknown as Repository<PlaceEntity>, known(feedPostId) as unknown as Repository<FeedPostEntity>, known(microEventId) as unknown as Repository<MicroEventEntity>);
}

describe("ReportsService", () => {
  it("records a report against an event and lists it as open", async () => {
    const repo = createStoreRepo();
    const service = createService(repo);
    const created = await service.create(userId, { eventId, reason: "spam" });
    expect(created.targetType).toBe("event");
    expect(created.targetId).toBe(eventId);
    expect(created.status).toBe("open");
    const open = await service.listOpen();
    expect(open).toHaveLength(1);
  });

  it("records a report against a micro-event", async () => {
    const repo = createStoreRepo();
    const created = await createService(repo).create(userId, { microEventId, reason: "inappropriate" });
    expect(created.targetType).toBe("micro_event");
    expect(created.targetId).toBe(microEventId);
  });

  it("rejects a second report from the same user on the same target", async () => {
    const repo = createStoreRepo();
    const service = createService(repo);
    await service.create(userId, { eventId, reason: "spam" });
    await expect(service.create(userId, { eventId, reason: "abuse" })).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects a payload that does not name exactly one target", async () => {
    const repo = createStoreRepo();
    await expect(createService(repo).create(userId, { reason: "spam" })).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects a report whose target does not exist and stores nothing", async () => {
    const repo = createStoreRepo();
    const service = createService(repo);
    await expect(service.create(userId, { eventId: missingId, reason: "spam" })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.create(userId, { placeId: missingId, reason: "spam" })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.create(userId, { feedPostId: missingId, reason: "spam" })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.create(userId, { microEventId: missingId, reason: "spam" })).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.store).toHaveLength(0);
  });
});
