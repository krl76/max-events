import { ConflictException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { QueryFailedError, type Repository } from "typeorm";
import { ReportEntity } from "./report.entity";
import { ReportsService } from "./reports.service";

const now = new Date("2026-09-12T10:00:00Z");
const userId = "00000000-0000-4000-8000-00000000000a";
const eventId = "00000000-0000-4000-8000-0000000000e1";

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

describe("ReportsService", () => {
  it("records a report against an event and lists it as open", async () => {
    const repo = createStoreRepo();
    const service = new ReportsService(repo as unknown as Repository<ReportEntity>);
    const created = await service.create(userId, { eventId, reason: "spam" });
    expect(created.targetType).toBe("event");
    expect(created.targetId).toBe(eventId);
    expect(created.status).toBe("open");
    const open = await service.listOpen();
    expect(open).toHaveLength(1);
  });

  it("rejects a second report from the same user on the same target", async () => {
    const repo = createStoreRepo();
    const service = new ReportsService(repo as unknown as Repository<ReportEntity>);
    await service.create(userId, { eventId, reason: "spam" });
    await expect(service.create(userId, { eventId, reason: "abuse" })).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects a payload that does not name exactly one target", async () => {
    const repo = createStoreRepo();
    const service = new ReportsService(repo as unknown as Repository<ReportEntity>);
    await expect(service.create(userId, { reason: "spam" })).rejects.toBeInstanceOf(ConflictException);
  });
});
