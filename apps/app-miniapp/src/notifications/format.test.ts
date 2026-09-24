import { describe, expect, it } from "vitest";
import type { AppNotification, NotificationAction } from "../api/client";
import { groupNotifications, notificationActorLabel, notificationAgo, notificationCountdown, notificationExpired, notificationGlyph, notificationIsChoice, notificationIsPending, notificationRoute, notificationShortAgo } from "./format";

// Полдень по местному времени: часовые арифметики ниже не должны зависеть от зоны машины.
const NOW = new Date(2026, 8, 19, 12, 0, 0);
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const EVENT_ID = "c0000001-0000-4000-8000-000000000001";

function notification(over: Partial<AppNotification> = {}): AppNotification {
  return {
    id: "f1000000-0000-4000-8000-000000000001",
    type: "weather",
    actor: null,
    title: "Дождь начнётся к 19:00",
    body: "До 18:00 сухо, дальше ливень.",
    quote: null,
    createdAt: new Date(NOW.getTime() - 20 * MINUTE).toISOString(),
    readAt: null,
    link: null,
    actions: [],
    deadlineAt: null,
    answeredActionId: null,
    urgent: false,
    ...over,
  };
}

const action = (id: string, over: Partial<NotificationAction> = {}): NotificationAction => ({ id, label: id, tone: "primary", link: null, ...over });

describe("notificationAgo", () => {
  it("writes the long stamp of a decision card the way the design does", () => {
    expect(notificationAgo(new Date(NOW.getTime() - 12 * MINUTE).toISOString(), NOW)).toBe("12 минут назад");
    expect(notificationAgo(new Date(NOW.getTime() - HOUR).toISOString(), NOW)).toBe("1 час назад");
  });

  it("agrees the noun with the number, teens included", () => {
    expect(notificationAgo(new Date(NOW.getTime() - MINUTE).toISOString(), NOW)).toBe("1 минуту назад");
    expect(notificationAgo(new Date(NOW.getTime() - 22 * MINUTE).toISOString(), NOW)).toBe("22 минуты назад");
    expect(notificationAgo(new Date(NOW.getTime() - 11 * MINUTE).toISOString(), NOW)).toBe("11 минут назад");
    expect(notificationAgo(new Date(NOW.getTime() - 3 * HOUR).toISOString(), NOW)).toBe("3 часа назад");
    expect(notificationAgo(new Date(NOW.getTime() - 5 * HOUR).toISOString(), NOW)).toBe("5 часов назад");
  });

  it("says «только что» under a minute and names the day past one", () => {
    expect(notificationAgo(new Date(NOW.getTime() - 30 * 1000).toISOString(), NOW)).toBe("только что");
    expect(notificationAgo(new Date(2026, 8, 18, 20, 0, 0).toISOString(), NOW)).toBe("вчера");
    expect(notificationAgo(new Date(2026, 8, 17, 12, 0, 0).toISOString(), NOW)).toBe("2 дня назад");
  });

  it("falls back to the date once a week has passed", () => {
    expect(notificationAgo(new Date(2026, 8, 1, 12, 0, 0).toISOString(), NOW)).toContain("сентября");
  });
});

describe("notificationShortAgo", () => {
  it("shortens the stamp of a history row to «3 ч» / «вчера» / «2 дня»", () => {
    expect(notificationShortAgo(new Date(NOW.getTime() - 3 * HOUR).toISOString(), NOW)).toBe("3 ч");
    expect(notificationShortAgo(new Date(2026, 8, 18, 22, 0, 0).toISOString(), NOW)).toBe("вчера");
    expect(notificationShortAgo(new Date(2026, 8, 17, 12, 0, 0).toISOString(), NOW)).toBe("2 дня");
  });

  it("stays in minutes inside the hour and drops to a date past the week", () => {
    expect(notificationShortAgo(new Date(NOW.getTime() - 40 * MINUTE).toISOString(), NOW)).toBe("40 мин");
    expect(notificationShortAgo(new Date(NOW.getTime() - 10 * 1000).toISOString(), NOW)).toBe("сейчас");
    expect(notificationShortAgo(new Date(2026, 7, 30, 12, 0, 0).toISOString(), NOW)).not.toContain("дн");
  });
});

describe("notificationCountdown", () => {
  it("counts a waitlist offer down as a stopwatch: minutes bare, seconds padded", () => {
    expect(notificationCountdown(new Date(NOW.getTime() + (14 * 60 + 18) * 1000).toISOString(), NOW)).toBe("14:18");
    expect(notificationCountdown(new Date(NOW.getTime() + 65 * 1000).toISOString(), NOW)).toBe("1:05");
  });

  it("shows nothing when nothing is counting or the time is already up", () => {
    expect(notificationCountdown(null, NOW)).toBeNull();
    expect(notificationCountdown(new Date(NOW.getTime() - 1000).toISOString(), NOW)).toBeNull();
  });
});

describe("notificationIsChoice", () => {
  it("calls a card a fork only when it offers more than one answer", () => {
    expect(notificationIsChoice(notification({ actions: [action("a"), action("b")] }))).toBe(true);
    expect(notificationIsChoice(notification({ actions: [action("a")] }))).toBe(false);
    expect(notificationIsChoice(notification())).toBe(false);
  });
});

describe("notificationIsPending", () => {
  it("waits only while something is pressable, nothing is pressed and the time is not up", () => {
    expect(notificationIsPending(notification({ actions: [action("a")] }), NOW)).toBe(true);
    expect(notificationIsPending(notification({ actions: [action("a")], answeredActionId: "a" }), NOW)).toBe(false);
    expect(notificationIsPending(notification(), NOW)).toBe(false);
  });

  it("stops waiting once the deadline passed, so an expired offer leaves the top of the screen", () => {
    const expired = notification({ actions: [action("a")], deadlineAt: new Date(NOW.getTime() - 1000).toISOString() });

    expect(notificationExpired(expired, NOW)).toBe(true);
    expect(notificationIsPending(expired, NOW)).toBe(false);
  });
});

describe("groupNotifications", () => {
  it("splits the screen into pending decisions and everything else, each newest first", () => {
    const older = notification({ id: "old", createdAt: new Date(NOW.getTime() - 3 * HOUR).toISOString() });
    const newer = notification({ id: "new", createdAt: new Date(NOW.getTime() - HOUR).toISOString() });
    const deciding = notification({ id: "decide", createdAt: new Date(NOW.getTime() - 2 * HOUR).toISOString(), actions: [action("a")] });

    const groups = groupNotifications([older, deciding, newer], NOW);

    expect(groups.pending.map((entry) => entry.id)).toEqual(["decide"]);
    expect(groups.earlier.map((entry) => entry.id)).toEqual(["new", "old"]);
  });

  it("drops an answered decision into the history instead of leaving it asking", () => {
    const answered = notification({ id: "answered", actions: [action("keep")], answeredActionId: "keep" });

    const groups = groupNotifications([answered], NOW);

    expect(groups.pending).toEqual([]);
    expect(groups.earlier.map((entry) => entry.id)).toEqual(["answered"]);
  });
});

describe("notificationActorLabel", () => {
  it("keeps the first name, which is what the design bolds", () => {
    expect(notificationActorLabel("Анна Соколова")).toBe("Анна");
    expect(notificationActorLabel("  Дима  ")).toBe("Дима");
  });
});

describe("notificationGlyph", () => {
  it("gives every type a glyph, so a new backend kind cannot land as an empty circle", () => {
    expect(notificationGlyph("plan-message")).toBe("users");
    expect(notificationGlyph("achievement")).toBe("spark");
    expect(notificationGlyph("weather")).toBe("rain");
    expect(notificationGlyph("organizer-booking")).toBe("ticket");
  });
});

describe("notificationRoute", () => {
  it("maps the targets that need an id onto the routes that carry one", () => {
    expect(notificationRoute({ target: "event", id: EVENT_ID })).toEqual({ name: "event", id: EVENT_ID });
    expect(notificationRoute({ target: "slot-booking", id: "b1" })).toEqual({ name: "slot-booking", placeId: "b1" });
    expect(notificationRoute({ target: "companions", id: EVENT_ID })).toEqual({ name: "companions", eventId: EVENT_ID });
  });

  it("maps the targets that take no id onto their bare routes", () => {
    expect(notificationRoute({ target: "map", id: null })).toEqual({ name: "map" });
    expect(notificationRoute({ target: "achievements", id: null })).toEqual({ name: "achievements" });
    expect(notificationRoute({ target: "bookings", id: null })).toEqual({ name: "bookings" });
  });

  it("refuses to open a screen on nothing", () => {
    expect(notificationRoute(null)).toBeNull();
    expect(notificationRoute({ target: "event", id: null })).toBeNull();
    expect(notificationRoute({ target: "plan", id: "" })).toBeNull();
  });
});
