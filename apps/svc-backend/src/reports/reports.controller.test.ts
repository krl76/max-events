import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { describe, expect, it } from "vitest";
import type { Report } from "@max-events/api-contracts";
import { UserEntity } from "../users/user.entity";
import type { ModerationService } from "./moderation.service";
import { ModerationController, ReportsController } from "./reports.controller";
import type { ReportsService } from "./reports.service";

const admin = { id: "00000000-0000-4000-8000-00000000000a", maxUserId: "42" } as UserEntity;
const visitor = { id: "00000000-0000-4000-8000-00000000000b", maxUserId: "7" } as UserEntity;
const targetId = "00000000-0000-4000-8000-0000000000e1";
const report: Report = {
  id: "00000000-0000-4000-8000-0000000000r1",
  userId: visitor.id,
  targetType: "event",
  targetId,
  reason: "spam",
  status: "open",
  source: "user",
  createdAt: "2026-09-12T10:00:00.000Z",
};

function createControllers() {
  const calls: { list?: boolean; resolve?: string; spotCheck?: string; unpublish?: { targetType: string; targetId: string }; ban?: string } = {};
  const reports = {
    create: async () => report,
    spotCheck: async (moderatorId: string) => {
      calls.spotCheck = moderatorId;
      return { ...report, source: "spot_check" as const };
    },
    listOpen: async () => {
      calls.list = true;
      return [report];
    },
    resolve: async (id: string) => {
      calls.resolve = id;
      return { ...report, status: "resolved" as const };
    },
  } as unknown as ReportsService;
  const moderation = {
    unpublish: async (targetType: string, id: string) => {
      calls.unpublish = { targetType, targetId: id };
    },
    banOrganizer: async (userId: string) => {
      calls.ban = userId;
    },
  } as unknown as ModerationService;
  const config = new ConfigService({ MODERATOR_MAX_USER_IDS: "42" });
  return {
    calls,
    reports: new ReportsController(reports, config),
    moderation: new ModerationController(moderation, config),
  };
}

describe("ReportsController and ModerationController", () => {
  it("lets any authenticated user file a report", async () => {
    const { reports } = createControllers();
    await expect(reports.create(visitor, { eventId: targetId, reason: "spam" })).resolves.toMatchObject({ targetId, status: "open" });
  });

  it("forbids a non-moderator from the queue, spot checks and sanctions", async () => {
    const { reports, moderation } = createControllers();
    expect(() => reports.list(visitor)).toThrow(ForbiddenException);
    expect(() => reports.resolve(visitor, report.id)).toThrow(ForbiddenException);
    await expect(reports.spotCheck(visitor, { eventId: targetId, reason: "other" })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(moderation.unpublish(visitor, { targetType: "event", targetId })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(moderation.ban(visitor, { userId: admin.id })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lets a listed moderator queue a spot check", async () => {
    const { calls, reports } = createControllers();
    await expect(reports.spotCheck(admin, { eventId: targetId, reason: "other" })).resolves.toMatchObject({ source: "spot_check" });
    expect(calls.spotCheck).toBe(admin.id);
    await expect(reports.spotCheck(admin, { eventId: targetId, reason: "nope" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("lets a listed moderator list, resolve, unpublish and ban", async () => {
    const { calls, reports, moderation } = createControllers();
    await expect(reports.list(admin)).resolves.toHaveLength(1);
    await expect(reports.resolve(admin, report.id)).resolves.toMatchObject({ status: "resolved" });
    await expect(moderation.unpublish(admin, { targetType: "event", targetId })).resolves.toEqual({ ok: true });
    await expect(moderation.ban(admin, { userId: visitor.id })).resolves.toEqual({ ok: true });
    expect(calls.list).toBe(true);
    expect(calls.resolve).toBe(report.id);
    expect(calls.unpublish).toEqual({ targetType: "event", targetId });
    expect(calls.ban).toBe(visitor.id);
  });
});
