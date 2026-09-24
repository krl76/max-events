import { afterEach, describe, expect, it } from "vitest";
import { ApiClient } from "./client";
import { installMockApi, resetMockNotifications } from "./mock";

const DEMO_USER_ID = "a0000000-0000-4000-8000-000000000001";

describe("mock notifications inbox (макет, экран 07)", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockNotifications();
  });

  it("answers the seven entries of the design, newest first", async () => {
    restore = installMockApi();

    const inbox = await new ApiClient("/api").listNotifications(DEMO_USER_ID);

    expect(inbox).toHaveLength(7);
    expect(inbox[0].title).toBe("Концерт The Weekend через 1 ч 40 мин");
    expect(inbox.map((entry) => entry.createdAt)).toEqual([...inbox.map((entry) => entry.createdAt)].sort().reverse());
  });

  it("carries the decisions with their pills and the history without any", async () => {
    restore = installMockApi();

    const inbox = await new ApiClient("/api").listNotifications(DEMO_USER_ID);
    const deciding = inbox.filter((entry) => entry.actions.length > 0);
    const history = inbox.filter((entry) => entry.actions.length === 0);

    expect(deciding).toHaveLength(4);
    expect(history).toHaveLength(3);
    // «Дождь начнётся к 19:00» — единственная запись с выбором из двух ответов.
    const choice = deciding.find((entry) => entry.actions.length === 2)!;
    expect(choice.actions.map((action) => action.label)).toEqual(["Перенести под навес", "Оставить как есть"]);
    expect(choice.actions[1].link).toBeNull();
  });

  it("counts the unread behind the header bell and clears it when the inbox is read", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");

    expect((await client.getNotificationsSummary(DEMO_USER_ID)).unreadCount).toBe(3);
    expect((await client.markAllNotificationsRead(DEMO_USER_ID)).unreadCount).toBe(0);
    expect((await client.listNotifications(DEMO_USER_ID)).every((entry) => entry.readAt !== null)).toBe(true);
  });

  it("marks one entry read idempotently and leaves the rest alone", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");
    const [first] = await client.listNotifications(DEMO_USER_ID);

    expect((await client.markNotificationRead(first.id, DEMO_USER_ID)).readAt).not.toBeNull();
    expect((await client.markNotificationRead(first.id, DEMO_USER_ID)).readAt).not.toBeNull();
    expect((await client.getNotificationsSummary(DEMO_USER_ID)).unreadCount).toBe(2);
  });

  it("records the answer to a decision and reads the entry along with it", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");
    const choice = (await client.listNotifications(DEMO_USER_ID)).find((entry) => entry.actions.length === 2)!;

    const answered = await client.answerNotification(choice.id, { userId: DEMO_USER_ID, actionId: "keep" });

    expect(answered.answeredActionId).toBe("keep");
    expect(answered.readAt).not.toBeNull();
  });

  it("gives the waitlist offer a deadline to count down to and marks it urgent", async () => {
    restore = installMockApi();

    const offer = (await new ApiClient("/api").listNotifications(DEMO_USER_ID)).find((entry) => entry.type === "seat-freed")!;

    expect(offer.deadlineAt).not.toBeNull();
    expect(new Date(offer.deadlineAt!).getTime()).toBeGreaterThan(Date.now());
    expect(offer.urgent).toBe(true);
  });

  it("rejects an unknown entry, an unknown action and a write without a viewer", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");
    const [first] = await client.listNotifications(DEMO_USER_ID);

    await expect(client.markNotificationRead("f1000000-0000-4000-8000-0000000000ff", DEMO_USER_ID)).rejects.toMatchObject({ name: "ApiError", status: 404 });
    await expect(client.answerNotification(first.id, { userId: DEMO_USER_ID, actionId: "nope" })).rejects.toMatchObject({ name: "ApiError", status: 404 });
    await expect(client.markNotificationRead(first.id, "")).rejects.toMatchObject({ name: "ApiError", status: 400 });
    await expect(client.markAllNotificationsRead("")).rejects.toMatchObject({ name: "ApiError", status: 400 });
  });
});
