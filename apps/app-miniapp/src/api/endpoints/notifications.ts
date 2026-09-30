// START_MODULE_CONTRACT
// PURPOSE: Notifications endpoints of the api client: the inbox of макет, экран 07 plus the unread count behind the feed header bell.
// SCOPE: GET /notifications, GET /notifications/summary, POST /notifications/:id/read, POST /notifications/read-all, POST /notifications/:id/answer. Identity comes from the init-data token; userId query/body is a mock-only convenience.
// DEPENDS: ./transport.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - NOTIFICATION_TYPES - re-exported list of inbox types
// - NotificationType - re-exported inbox type
// - NOTIFICATION_TARGETS - re-exported list of target screens
// - NotificationLink - re-exported link a notification opens
// - NotificationTarget - re-exported target screen
// - NotificationActionTone - re-exported action tone
// - NotificationAction - re-exported action button
// - AppNotification - re-exported notification
// - NotificationsSummary - re-exported unread counters
// - AnswerNotification - answer payload; userId is mock-only
// - withNotifications - list / summary / read / read-all / answer
// END_MODULE_MAP

import { AppNotificationSchema, NotificationsSummarySchema } from "@max-events/api-contracts";
import type { AppNotification, NotificationsSummary } from "@max-events/api-contracts";
import type { ApiMixin } from "./transport";

export { NOTIFICATION_TARGETS, NOTIFICATION_TYPES } from "@max-events/api-contracts";
export type { AppNotification, NotificationAction, NotificationActionTone, NotificationLink, NotificationTarget, NotificationType, NotificationsSummary } from "@max-events/api-contracts";

/** Answer payload of a decision; the userId is a mock-only convenience, the real endpoint reads identity from the init-data token. */
export interface AnswerNotification {
  userId: string;
  actionId: string;
}

export function withNotifications<TBase extends ApiMixin>(Base: TBase) {
  return class NotificationEndpoints extends Base {
    /** The inbox of экран 07, newest first; the userId param is a mock-only convenience, as elsewhere. */
    listNotifications(userId: string): Promise<AppNotification[]> {
      return this.request(`/notifications?userId=${encodeURIComponent(userId)}`, AppNotificationSchema.array());
    }

    /** Unread count behind the header bell: a separate path because the feed must not fetch the whole inbox to draw a badge. */
    getNotificationsSummary(userId: string, options: { asVisitor?: boolean } = {}): Promise<NotificationsSummary> {
      return this.request(`/notifications/summary?userId=${encodeURIComponent(userId)}`, NotificationsSummarySchema, { asVisitor: options.asVisitor === true });
    }

    /** Marks one entry read — what tapping a row that navigates away does; idempotent, keeps the first readAt. */
    markNotificationRead(id: string, userId: string): Promise<AppNotification> {
      return this.request(`/notifications/${id}/read?userId=${encodeURIComponent(userId)}`, AppNotificationSchema, { method: "POST" });
    }

    /** Marks the whole inbox read and answers with the count the bell should now show (zero). */
    markAllNotificationsRead(userId: string): Promise<NotificationsSummary> {
      return this.request("/notifications/read-all", NotificationsSummarySchema, { body: { userId } });
    }

    /** Records the answer to a decision: the entry stops waiting and drops out of «Требует решения». */
    answerNotification(id: string, payload: AnswerNotification): Promise<AppNotification> {
      return this.request(`/notifications/${id}/answer`, AppNotificationSchema, { body: payload });
    }
  };
}
