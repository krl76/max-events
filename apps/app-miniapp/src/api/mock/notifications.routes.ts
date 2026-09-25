// START_MODULE_CONTRACT
// PURPOSE: Mock route table of the notifications domain: the inbox of макет, экран 07, the unread count behind the feed header bell, the two read writes and the answer to a decision.
// SCOPE: GET /api/notifications, GET /api/notifications/summary, POST /api/notifications/read-all, POST /api/notifications/:id/read, POST /api/notifications/:id/answer.
// DEPENDS: ./notifications.js, ./fixtures.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - notificationsRoutes - route table entry: null when the path belongs to another domain
// END_MODULE_MAP

import { parseBookingBody } from "./fixtures";
import { answerMockNotification, markAllMockNotificationsRead, markMockNotificationRead, mockNotifications, mockNotificationsSummary } from "./notifications";

export function notificationsRoutes(url: URL, init: RequestInit | undefined): Response | null {
  // Ahead of /api/notifications on purpose only for readability — the paths are matched exactly, so the order is free.
  if (url.pathname === "/api/notifications/summary") {
    return Response.json(mockNotificationsSummary());
  }
  if (url.pathname === "/api/notifications/read-all" && init?.method === "POST") {
    const payload = parseBookingBody(init) as { userId?: string } | undefined;
    if (typeof payload !== "object" || payload === null || typeof payload.userId !== "string" || payload.userId === "") return new Response(null, { status: 400 });
    return Response.json(markAllMockNotificationsRead());
  }
  const read = /^\/api\/notifications\/([^/]+)\/read$/.exec(url.pathname);
  if (read && init?.method === "POST") {
    if ((url.searchParams.get("userId") ?? "") === "") return new Response(null, { status: 400 });
    const notification = markMockNotificationRead(read[1]);
    return notification === null ? new Response(null, { status: 404 }) : Response.json(notification);
  }
  const answer = /^\/api\/notifications\/([^/]+)\/answer$/.exec(url.pathname);
  if (answer && init?.method === "POST") {
    const payload = parseBookingBody(init) as { userId?: string; actionId?: string } | undefined;
    if (typeof payload !== "object" || payload === null || typeof payload.userId !== "string" || payload.userId === "" || typeof payload.actionId !== "string" || payload.actionId === "") return new Response(null, { status: 400 });
    const result = answerMockNotification(answer[1], payload.actionId);
    // Неизвестное действие — это 404 по действию, а не 400 по телу: тело корректно, цели нет.
    return result === "no_notification" || result === "no_action" ? new Response(null, { status: 404 }) : Response.json(result);
  }
  if (url.pathname === "/api/notifications") {
    return Response.json(mockNotifications());
  }
  return null;
}
