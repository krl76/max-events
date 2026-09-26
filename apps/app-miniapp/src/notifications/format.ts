// START_MODULE_CONTRACT
// PURPOSE: Pure reading rules of экран 07 «Умные уведомления»: how the inbox splits into «Требует решения» and «Раньше», how long ago each entry arrived, how much time a decision has left, which glyph a type wears and where a notification link leads inside this app.
// SCOPE: Pure functions over AppNotification and the clock; no fetching, no state, no markup — the screen that uses them is ./NotificationsPage.tsx.
// DEPENDS: ../api/client.js (AppNotification, NotificationLink, NotificationType), ../routing/router.js (Route), ../ui/icons.js (ActionIconName)
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - notificationIsChoice - whether the entry asks the viewer to pick between answers rather than just offering one; the screen washes exactly these cards
// - notificationExpired - whether the decision ran out of time (deadline passed)
// - notificationIsPending - whether the entry still waits for a decision: it has actions, none was chosen and nothing expired
// - NotificationGroups - the two sections of экран 07 as one value: pending decisions and everything else
// - groupNotifications - the two sections of экран 07: pending decisions, then everything else, each newest first
// - notificationAgo - «12 минут назад» / «1 час назад» — the long stamp of a decision card
// - notificationShortAgo - «3 ч» / «вчера» / «2 дня» — the short stamp of a history row
// - notificationCountdown - «14:18» left on a decision, null when nothing is counting down or the time is up
// - notificationActorLabel - «Анна Соколова» -> «Анна»: the design bolds the first name, not the full one
// - notificationGlyph - type -> icon name; the glyph is what a history row shows instead of a face
// - notificationRoute - notification link -> the Route this app pushes, null when the target came without the id it needs
// END_MODULE_MAP

import type { AppNotification, NotificationLink, NotificationType } from "../api/client";
import type { Route } from "../routing/router";
import type { ActionIconName } from "../ui/icons";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * Russian agreement by count: 1 минуту, 2 минуты, 5 минут — and the teens are all «много»
 * (11 минут, not 11 минуту), which is why the check on the last two digits comes first.
 */
function plural(count: number, one: string, few: string, many: string): string {
  const lastTwo = count % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  const last = count % 10;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

/** Whole calendar days between two moments — «вчера» means yesterday's date, not «24 часа назад». */
function calendarDaysBetween(from: Date, to: Date): number {
  const fromDay = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const toDay = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((toDay - fromDay) / (24 * HOUR_MS));
}

/**
 * A card with two answers is a fork — «Перенести под навес» или «Оставить как есть» — and экран 07
 * draws exactly that one washed in brand-cyan with its type glyph in the headline. A card with a
 * single pill is a shortcut, not a fork, so it stays on the plain surface. The distinction is read
 * off the actions rather than stored, so a notification cannot claim attention it has not earned.
 */
export function notificationIsChoice(notification: AppNotification): boolean {
  return notification.actions.length > 1;
}

export function notificationExpired(notification: AppNotification, now: Date = new Date()): boolean {
  return notification.deadlineAt !== null && new Date(notification.deadlineAt).getTime() <= now.getTime();
}

/** «Требует решения» is this and nothing else: something to press, nothing pressed yet, time not up. */
export function notificationIsPending(notification: AppNotification, now: Date = new Date()): boolean {
  return notification.actions.length > 0 && notification.answeredActionId === null && !notificationExpired(notification, now);
}

export interface NotificationGroups {
  /** «Требует решения»: the cards at the top, newest first. */
  pending: AppNotification[];
  /** «Раньше»: history and settled decisions, newest first. */
  earlier: AppNotification[];
}

export function groupNotifications(notifications: readonly AppNotification[], now: Date = new Date()): NotificationGroups {
  const byNewest = [...notifications].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return {
    pending: byNewest.filter((entry) => notificationIsPending(entry, now)),
    earlier: byNewest.filter((entry) => !notificationIsPending(entry, now)),
  };
}

/** The long stamp of a decision card: «12 минут назад», «1 час назад». */
export function notificationAgo(createdAt: string, now: Date = new Date()): string {
  const created = new Date(createdAt);
  const elapsed = now.getTime() - created.getTime();
  if (elapsed < MINUTE_MS) return "только что";
  if (elapsed < HOUR_MS) {
    const minutes = Math.floor(elapsed / MINUTE_MS);
    return `${minutes} ${plural(minutes, "минуту", "минуты", "минут")} назад`;
  }
  const days = calendarDaysBetween(created, now);
  if (days === 0) {
    const hours = Math.floor(elapsed / HOUR_MS);
    return `${hours} ${plural(hours, "час", "часа", "часов")} назад`;
  }
  if (days === 1) return "вчера";
  if (days < 7) return `${days} ${plural(days, "день", "дня", "дней")} назад`;
  return created.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

/** The short stamp of a history row: «3 ч», «вчера», «2 дня». */
export function notificationShortAgo(createdAt: string, now: Date = new Date()): string {
  const created = new Date(createdAt);
  const elapsed = now.getTime() - created.getTime();
  if (elapsed < MINUTE_MS) return "сейчас";
  const days = calendarDaysBetween(created, now);
  if (days === 0) return elapsed < HOUR_MS ? `${Math.floor(elapsed / MINUTE_MS)} мин` : `${Math.floor(elapsed / HOUR_MS)} ч`;
  if (days === 1) return "вчера";
  if (days < 7) return `${days} ${plural(days, "день", "дня", "дней")}`;
  return created.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

/**
 * «Занять слот · 14:18»: minutes are not padded and seconds are, the way a stopwatch reads.
 * Null once the offer is gone — a countdown at 0:00 promises a window that is already taken.
 */
export function notificationCountdown(deadlineAt: string | null, now: Date = new Date()): string | null {
  if (deadlineAt === null) return null;
  const left = Math.floor((new Date(deadlineAt).getTime() - now.getTime()) / 1000);
  if (left <= 0) return null;
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
}

/** The design bolds «Анна», not «Анна Соколова»: one name reads as a person, two read as a record. */
export function notificationActorLabel(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

/**
 * The glyph a history row wears instead of a face. Every type has one, including the kinds no fixture
 * produces yet: an entry the backend starts sending must not land on the screen as an empty circle.
 */
const NOTIFICATION_GLYPHS: Record<NotificationType, ActionIconName> = {
  "leave-now": "navigation",
  weather: "rain",
  "friend-left": "users",
  "list-digest": "bookmark",
  "seat-freed": "seat",
  "event-soon": "clock",
  "gathering-invite": "friends",
  "gathering-response": "check",
  vote: "cards",
  "plan-message": "users",
  "plan-invite": "users",
  "micro-invite": "friends",
  "friend-activity": "users",
  "organizer-booking": "ticket",
  moderation: "shield",
  achievement: "spark",
};

export function notificationGlyph(type: NotificationType): ActionIconName {
  return NOTIFICATION_GLYPHS[type];
}

/**
 * Server target -> the Route this app pushes. A target that needs an id and arrives without one maps
 * to null rather than to a screen that would open on nothing, so the row simply stops being tappable.
 */
export function notificationRoute(link: NotificationLink | null): Route | null {
  if (link === null) return null;
  const { target, id } = link;
  if (target === "map") return { name: "map" };
  if (target === "bookings") return { name: "bookings" };
  if (target === "moderation") return { name: "moderation" };
  if (target === "organizer") return { name: "organizer" };
  if (target === "achievements") return { name: "achievements" };
  if (id === null || id === "") return null;
  if (target === "micro") return { name: "micro-event", id };
  if (target === "slot-booking") return { name: "slot-booking", placeId: id };
  if (target === "companions") return { name: "companions", eventId: id };
  return { name: target, id };
}
