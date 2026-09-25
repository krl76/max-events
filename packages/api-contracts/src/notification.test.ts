import { describe, expect, it } from "vitest";
import { AnswerNotificationWriteSchema, AppNotificationSchema, NotificationsSummarySchema } from "./notification.js";

const notificationId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d91";

const validNotification = {
  id: notificationId,
  type: "weather",
  title: "Дождь начнётся к 19:00",
  createdAt: "2026-09-19T12:00:00+03:00",
};

describe("AppNotificationSchema", () => {
  it("defaults an unread compact row with no actor or actions", () => {
    const parsed = AppNotificationSchema.parse(validNotification);
    expect(parsed.readAt).toBeNull();
    expect(parsed.actor).toBeNull();
    expect(parsed.actions).toEqual([]);
    expect(parsed.urgent).toBe(false);
    expect(parsed.body).toBe("");
  });

  it("rejects an unknown type", () => {
    expect(AppNotificationSchema.safeParse({ ...validNotification, type: "sms" }).success).toBe(false);
  });
});

describe("NotificationsSummarySchema", () => {
  it("accepts a non-negative unread count", () => {
    expect(NotificationsSummarySchema.parse({ unreadCount: 3 }).unreadCount).toBe(3);
    expect(NotificationsSummarySchema.safeParse({ unreadCount: -1 }).success).toBe(false);
  });
});

describe("AnswerNotificationWriteSchema", () => {
  it("requires a non-empty action id", () => {
    expect(AnswerNotificationWriteSchema.parse({ actionId: "keep" }).actionId).toBe("keep");
    expect(AnswerNotificationWriteSchema.safeParse({ actionId: "" }).success).toBe(false);
  });
});
