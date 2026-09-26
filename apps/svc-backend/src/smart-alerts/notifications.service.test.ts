import { NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import type { NotificationAction } from "@max-events/api-contracts";
import { UserEntity } from "../users/user.entity";
import { NotificationEntity } from "./notification.entity";
import { NotificationsService } from "./notifications.service";

const now = new Date("2026-09-19T12:00:00Z");
const userId = "00000000-0000-4000-8000-00000000000a";
const otherUserId = "00000000-0000-4000-8000-00000000000b";
const actorId = "00000000-0000-4000-8000-00000000000c";
const keep: NotificationAction = { id: "keep", label: "Оставить как есть", tone: "secondary", link: null };

function createRows(initial: NotificationEntity[] = []) {
  const store = [...initial];
  return {
    store,
    find: async (opts: { where?: { userId?: string } } = {}) => store.filter((row) => !opts.where?.userId || row.userId === opts.where.userId),
    findOneBy: async (where: { id?: string; userId?: string }) => store.find((row) => (!where.id || row.id === where.id) && (!where.userId || row.userId === where.userId)) ?? null,
    save: async (entity: NotificationEntity) => {
      if (!store.includes(entity)) store.push(entity);
      return entity;
    },
  };
}

function row(overrides: Partial<NotificationEntity> = {}): NotificationEntity {
  return {
    id: "00000000-0000-4000-8000-0000000000n1",
    userId,
    type: "weather",
    actorUserId: null,
    title: "Дождь",
    body: "Навес",
    quote: null,
    createdAt: now,
    readAt: null,
    link: null,
    actions: [keep],
    deadlineAt: null,
    answeredActionId: null,
    urgent: false,
    ...overrides,
  } as NotificationEntity;
}

function createService(initial: NotificationEntity[] = []) {
  const rows = createRows(initial);
  const users = {
    findByIds: async (ids: string[]) => (ids.includes(actorId) ? [{ id: actorId, firstName: "Дима", lastName: "Кузнецов", avatarUrl: null } as UserEntity] : []),
  };
  return { service: new NotificationsService(rows as unknown as Repository<NotificationEntity>, users as never), rows };
}

describe("NotificationsService", () => {
  it("lists the current user's inbox newest first and hides another user's rows", async () => {
    const mine = row();
    const older = row({ id: "00000000-0000-4000-8000-0000000000n0", createdAt: new Date("2026-09-19T11:00:00Z"), title: "Старое" });
    const foreign = row({ id: "00000000-0000-4000-8000-0000000000n2", userId: otherUserId, title: "Чужое" });
    const { service } = createService([mine, older, foreign]);
    const listed = await service.list(userId);
    expect(listed.map((item) => item.title)).toEqual(["Дождь", "Старое"]);
    expect(await service.summary(userId)).toEqual({ unreadCount: 2 });
  });

  it("marks one entry read once and answers a known action", async () => {
    const { service } = createService([row({ actorUserId: actorId })]);
    const read = await service.markRead(userId, "00000000-0000-4000-8000-0000000000n1", now);
    expect(read.readAt).toBe(now.toISOString());
    expect(read.actor?.name).toBe("Дима Кузнецов");
    const again = await service.markRead(userId, "00000000-0000-4000-8000-0000000000n1", new Date("2026-09-20T12:00:00Z"));
    expect(again.readAt).toBe(now.toISOString());
    const answered = await service.answer(userId, "00000000-0000-4000-8000-0000000000n1", "keep", now);
    expect(answered.answeredActionId).toBe("keep");
    await expect(service.answer(userId, "00000000-0000-4000-8000-0000000000n1", "missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("marks the whole inbox read and 404s a foreign id", async () => {
    const { service } = createService([row(), row({ id: "00000000-0000-4000-8000-0000000000n2", userId: otherUserId })]);
    expect(await service.markAllRead(userId, now)).toEqual({ unreadCount: 0 });
    expect(await service.summary(userId)).toEqual({ unreadCount: 0 });
    expect(await service.summary(otherUserId)).toEqual({ unreadCount: 1 });
    await expect(service.markRead(userId, "00000000-0000-4000-8000-0000000000n2")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("confirms a plan when the inbox button says going", async () => {
    const planId = "00000000-0000-4000-8000-0000000000c1";
    const calls: string[] = [];
    const plans = { respond: async (id: string, target: string, status: string) => void calls.push(`${id}:${target}:${status}`) };
    const rows = createRows([row({ type: "plan-invite", link: { target: "plan", id: planId }, actions: [{ id: "going", label: "Пойду", tone: "confirm", link: null }] })]);
    const users = { findByIds: async () => [] };
    const service = new NotificationsService(rows as unknown as Repository<NotificationEntity>, users as never, plans as never);
    await service.answer(userId, "00000000-0000-4000-8000-0000000000n1", "going", now);
    expect(calls).toEqual([`${userId}:${planId}:confirmed`]);
  });
});
