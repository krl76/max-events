import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { UserEntity } from "../users/user.entity";
import { NotificationsController } from "./notifications.controller";
import type { NotificationsService } from "./notifications.service";

const user = { id: "00000000-0000-4000-8000-00000000000a" } as UserEntity;
const notification = { id: "00000000-0000-4000-8000-0000000000n1", title: "Дождь", answeredActionId: null };

describe("NotificationsController", () => {
  it("lists the inbox, marks read, and answers a decision", async () => {
    const calls: { answer?: string } = {};
    const service = {
      list: async () => [notification],
      summary: async () => ({ unreadCount: 1 }),
      markRead: async () => ({ ...notification, readAt: "2026-09-19T12:00:00.000Z" }),
      markAllRead: async () => ({ unreadCount: 0 }),
      answer: async (_userId: string, _id: string, actionId: string) => {
        calls.answer = actionId;
        return { ...notification, answeredActionId: actionId };
      },
    } as unknown as NotificationsService;
    const controller = new NotificationsController(service);
    await expect(controller.list(user)).resolves.toEqual([notification]);
    await expect(controller.summary(user)).resolves.toEqual({ unreadCount: 1 });
    await expect(controller.markAllRead(user)).resolves.toEqual({ unreadCount: 0 });
    await expect(controller.answer(user, notification.id, { actionId: "keep" })).resolves.toMatchObject({ answeredActionId: "keep" });
    expect(calls.answer).toBe("keep");
    await expect(controller.answer(user, notification.id, {})).rejects.toBeInstanceOf(BadRequestException);
  });
});
