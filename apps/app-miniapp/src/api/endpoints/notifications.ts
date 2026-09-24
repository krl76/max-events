// START_MODULE_CONTRACT
// PURPOSE: Notifications endpoints of the api client: the inbox of макет, экран 07 — what happened, who caused it, when, whether it was read, where it leads and what decision it still waits for — plus the unread count behind the feed header bell.
// SCOPE: GET /notifications, GET /notifications/summary, POST /notifications/:id/read, POST /notifications/read-all, POST /notifications/:id/answer. Nothing on the backend answers any of it (#494): smart-alerts, reminders, leave-now and list-digest are schedulers of outgoing MAX DMs, not an inbox with read state — so this file is the shape and the paths that endpoint will take, and ./../mock/notifications.ts is what serves them today.
// DEPENDS: ./transport.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - NOTIFICATION_TYPES - what can produce a notification, in one closed list; the first four are the alert kinds SmartAlertSettings already toggles (leaveNow/weather/friendLeft/listDigest), the rest are the product events that reach a person today
// - NotificationType - union of NOTIFICATION_TYPES
// - NOTIFICATION_TARGETS - the screens a notification can open, named in server vocabulary (the client maps them onto its Route in ../../notifications/format.ts)
// - NotificationTarget - union of NOTIFICATION_TARGETS
// - NotificationLink - where a notification or one of its actions leads: a target plus the id it needs
// - NotificationActionTone - form of an action pill: filled = main action, dark fill = confirmation, outline = the quiet alternative
// - NotificationAction - one pill on a decision card: stable id, label, tone and where it leads (null when it only answers)
// - AppNotification - one inbox entry: type, actor, text, when, read state, where it leads, the decision it waits for and its deadline
// - NotificationsSummary - unread count behind the feed header bell
// - AnswerNotification - answer payload of a decision: who answered and which action they chose
// - withNotifications - ApiClient.listNotifications / getNotificationsSummary / markNotificationRead / markAllNotificationsRead / answerNotification
// END_MODULE_MAP

import { FriendSchema } from "@max-events/api-contracts";
import type { Friend } from "@max-events/api-contracts";
import type { ApiMixin, ZodSchema } from "./transport";

/**
 * What produced the notification. One closed list on purpose: the screen draws a glyph per type and
 * the future backend will need the same vocabulary to fan its senders out into an inbox.
 *
 * The first four already exist as outgoing MAX DMs and are already toggled per user by
 * SmartAlertSettings (leaveNow / weather / friendLeft / listDigest in @max-events/api-contracts), so
 * an inbox built later inherits both the kinds and their per-user switches instead of inventing new
 * ones. The rest are the product events that reach a person today — an invitation to a gathering, an
 * answer to one, a seat freed from a waitlist, an event about to start, a vote in a «Мы» group, a new
 * booking for an organizer and a moderation verdict.
 */
export const NOTIFICATION_TYPES = ["leave-now", "weather", "friend-left", "list-digest", "seat-freed", "event-soon", "gathering-invite", "gathering-response", "vote", "plan-message", "friend-activity", "organizer-booking", "moderation", "achievement"] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/**
 * Where a notification can lead. Named in the server's vocabulary rather than in the client's Route
 * union: the endpoint cannot know how this app spells its screens, and a second client would spell
 * them differently. ../../notifications/format.ts maps a target onto the Route this app uses.
 */
export const NOTIFICATION_TARGETS = ["event", "place", "plan", "map", "slot-booking", "slot-ticket", "bookings", "we-group", "vote", "gathering", "companions", "moderation", "organizer", "achievements"] as const;

export type NotificationTarget = (typeof NOTIFICATION_TARGETS)[number];

export interface NotificationLink {
  target: NotificationTarget;
  /** Id the target needs (event, place, plan, booking, group, vote, gathering); null for the targets that take none. */
  id: string | null;
}

/** Form carries the meaning, as everywhere else in this app: filled pill = main action, dark fill = confirmation, outline = the quiet alternative («Оставить как есть»). */
export type NotificationActionTone = "primary" | "confirm" | "secondary";

/** One pill on a decision card (макет, экран 07). */
export interface NotificationAction {
  /** Stable within the notification: this is what POST /notifications/:id/answer records as the answer. */
  id: string;
  label: string;
  tone: NotificationActionTone;
  /** Where the action takes the viewer; null when it only answers and opens nothing («Оставить как есть»). */
  link: NotificationLink | null;
}

/**
 * One entry of the inbox (макет, экран 07).
 *
 * A notification with actions is a decision and is drawn as a card under «Требует решения» until it
 * is answered; a notification without them is one line under «Раньше». That is the whole grouping
 * rule of the screen — see groupNotifications in ../../notifications/format.ts — so nothing here has
 * to carry a section name the server would then have to keep in sync with the design.
 */
export interface AppNotification {
  id: string;
  type: NotificationType;
  /** Who caused it; null for the scheduler kinds nobody caused (weather, digest, achievement). */
  actor: Friend | null;
  /** Headline of a decision card, or the line of a compact row (which prefixes the actor's name itself). */
  title: string;
  /** Second line of a decision card; empty string for a compact row, which has none. */
  body: string;
  /** Muted tail after the line («кто берёт лимонад?»); null when there is none. */
  quote: string | null;
  createdAt: string;
  /** null while unread; the bell counts exactly the notifications whose readAt is null. */
  readAt: string | null;
  /** Where the entry itself leads when tapped; null when only its actions lead anywhere. */
  link: NotificationLink | null;
  /** The pills of a decision card, in design order; empty for a compact row. */
  actions: NotificationAction[];
  /** When the decision expires — «Занять слот · 14:18» counts down to it; null when nothing expires. */
  deadlineAt: string | null;
  /** Which action the viewer took; null while the decision is still open. */
  answeredActionId: string | null;
  /** Delivered even inside quiet hours: «Только срочное: брони и отмены» (макет, экран 07). */
  urgent: boolean;
}

/** What the bell in the feed header counts (макет, экран 03). */
export interface NotificationsSummary {
  unreadCount: number;
}

/** Answer payload of a decision; the userId is a mock-only convenience, the real endpoint reads identity from the init-data token. */
export interface AnswerNotification {
  userId: string;
  actionId: string;
}

const isNullableString = (value: unknown): value is string | null => value === null || typeof value === "string";

function parseLink(raw: unknown): { ok: true; value: NotificationLink | null } | { ok: false } {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== "object") return { ok: false };
  const link = raw as Record<string, unknown>;
  if (typeof link.target !== "string" || !(NOTIFICATION_TARGETS as readonly string[]).includes(link.target)) return { ok: false };
  if (!isNullableString(link.id)) return { ok: false };
  return { ok: true, value: { target: link.target as NotificationTarget, id: link.id } };
}

function parseActions(raw: unknown): NotificationAction[] | null {
  if (!Array.isArray(raw)) return null;
  const actions: NotificationAction[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) return null;
    const action = item as Record<string, unknown>;
    if (typeof action.id !== "string" || typeof action.label !== "string") return null;
    if (action.tone !== "primary" && action.tone !== "confirm" && action.tone !== "secondary") return null;
    const link = parseLink(action.link);
    if (!link.ok) return null;
    actions.push({ id: action.id, label: action.label, tone: action.tone, link: link.value });
  }
  return actions;
}

function parseNotification(raw: unknown): AppNotification | null {
  if (typeof raw !== "object" || raw === null) return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.title !== "string" || typeof item.body !== "string" || typeof item.createdAt !== "string") return null;
  if (typeof item.type !== "string" || !(NOTIFICATION_TYPES as readonly string[]).includes(item.type)) return null;
  if (!isNullableString(item.quote) || !isNullableString(item.readAt) || !isNullableString(item.deadlineAt) || !isNullableString(item.answeredActionId)) return null;
  if (typeof item.urgent !== "boolean") return null;
  const actor = item.actor === null || item.actor === undefined ? null : FriendSchema.safeParse(item.actor);
  if (actor !== null && !actor.success) return null;
  const link = parseLink(item.link);
  const actions = parseActions(item.actions);
  if (!link.ok || actions === null) return null;
  return { id: item.id, type: item.type as NotificationType, actor: actor === null ? null : actor.data, title: item.title, body: item.body, quote: item.quote, createdAt: item.createdAt, readAt: item.readAt, link: link.value, actions, deadlineAt: item.deadlineAt, answeredActionId: item.answeredActionId, urgent: item.urgent };
}

const NotificationSchema: ZodSchema<AppNotification> = {
  safeParse(data: unknown) {
    const parsed = parseNotification(data);
    return parsed === null ? { success: false as const, error: "invalid notification" } : { success: true as const, data: parsed };
  },
};

const NotificationArraySchema: ZodSchema<AppNotification[]> = {
  safeParse(data: unknown) {
    if (!Array.isArray(data)) return { success: false as const, error: "expected a notification array" };
    const notifications: AppNotification[] = [];
    for (const item of data) {
      const parsed = parseNotification(item);
      if (parsed === null) return { success: false as const, error: "invalid notification" };
      notifications.push(parsed);
    }
    return { success: true as const, data: notifications };
  },
};

const NotificationsSummarySchema: ZodSchema<NotificationsSummary> = {
  safeParse(data: unknown) {
    if (typeof data !== "object" || data === null) return { success: false as const, error: "expected a notifications summary object" };
    const raw = data as Record<string, unknown>;
    if (typeof raw.unreadCount !== "number") return { success: false as const, error: "invalid notifications summary" };
    return { success: true as const, data: { unreadCount: raw.unreadCount } };
  },
};

export function withNotifications<TBase extends ApiMixin>(Base: TBase) {
  return class NotificationEndpoints extends Base {
    /** The inbox of экран 07, newest first; the userId param is a mock-only convenience, as elsewhere. */
    listNotifications(userId: string): Promise<AppNotification[]> {
      return this.request(`/notifications?userId=${encodeURIComponent(userId)}`, NotificationArraySchema);
    }

    /** Unread count behind the header bell: a separate path because the feed must not fetch the whole inbox to draw a badge. */
    getNotificationsSummary(userId: string): Promise<NotificationsSummary> {
      return this.request(`/notifications/summary?userId=${encodeURIComponent(userId)}`, NotificationsSummarySchema);
    }

    /** Marks one entry read — what tapping a row that navigates away does; idempotent, keeps the first readAt. */
    markNotificationRead(id: string, userId: string): Promise<AppNotification> {
      return this.request(`/notifications/${id}/read?userId=${encodeURIComponent(userId)}`, NotificationSchema, { method: "POST" });
    }

    /** Marks the whole inbox read and answers with the count the bell should now show (zero). The screen calls it on open: экран 07 draws no per-entry unread mark, so seeing the list IS reading it. */
    markAllNotificationsRead(userId: string): Promise<NotificationsSummary> {
      return this.request("/notifications/read-all", NotificationsSummarySchema, { body: { userId } });
    }

    /** Records the answer to a decision («Перенести под навес» / «Оставить как есть»): the entry stops waiting and drops out of «Требует решения». */
    answerNotification(id: string, payload: AnswerNotification): Promise<AppNotification> {
      return this.request(`/notifications/${id}/answer`, NotificationSchema, { body: payload });
    }
  };
}
