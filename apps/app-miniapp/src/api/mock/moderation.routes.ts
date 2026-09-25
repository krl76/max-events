// START_MODULE_CONTRACT
// PURPOSE: Mock route table for reporting and moderation: the queue, what its rows are about, the spot check, the resolve action and the two irreversible moderator writes.
// SCOPE: GET/POST /api/reports, POST /api/reports/spot-check, POST /api/reports/:id/resolve, GET /api/moderation/targets, POST /api/moderation/unpublish, POST /api/moderation/ban.
// DEPENDS: ./moderation.js, ./fixtures.js, ../client.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - moderationRoutes - route table entry: null when the path belongs to another domain
// END_MODULE_MAP

import { BanOrganizerWriteSchema, UnpublishWriteSchema } from "@max-events/api-contracts";
import { type CreateReport } from "../client";
import { mockDemoUser, parseBookingBody } from "./fixtures";
import { banMockOrganizer, createMockReport, isMockModerator, mockModerationTargets, openMockReports, resolveMockReport, spotCheckMockReport, unpublishMockTarget } from "./moderation";

export function moderationRoutes(url: URL, init: RequestInit | undefined): Response | null {
  if (url.pathname === "/api/reports" && init?.method !== "POST") {
    // The backend answers 403 to anyone outside MODERATOR_MAX_USER_IDS; the screen is hidden by it.
    if (!isMockModerator(mockDemoUser.id)) return new Response(null, { status: 403 });
    if ((url.searchParams.get("status") ?? "open") !== "open") return new Response(null, { status: 400 });
    return Response.json(openMockReports());
  }
  if (url.pathname === "/api/moderation/targets") {
    if (!isMockModerator(mockDemoUser.id)) return new Response(null, { status: 403 });
    return Response.json(mockModerationTargets());
  }
  if (url.pathname === "/api/reports/spot-check" && init?.method === "POST") {
    if (!isMockModerator(mockDemoUser.id)) return new Response(null, { status: 403 });
    const payload = parseBookingBody(init) as CreateReport | undefined;
    if (typeof payload !== "object" || payload === null || typeof payload.reason !== "string") return new Response(null, { status: 400 });
    const result = spotCheckMockReport({ ...payload, userId: mockDemoUser.id });
    return result === "no_target" ? new Response(null, { status: 404 }) : result === "invalid" ? new Response(null, { status: 400 }) : result === "duplicate" ? new Response(null, { status: 409 }) : Response.json(result);
  }
  const reportResolve = /^\/api\/reports\/([^/]+)\/resolve$/.exec(url.pathname);
  if (reportResolve && init?.method === "POST") {
    if (!isMockModerator(mockDemoUser.id)) return new Response(null, { status: 403 });
    const resolved = resolveMockReport(reportResolve[1]);
    return resolved ? Response.json(resolved) : new Response(null, { status: 404 });
  }
  if (url.pathname === "/api/moderation/unpublish" && init?.method === "POST") {
    if (!isMockModerator(mockDemoUser.id)) return new Response(null, { status: 403 });
    const parsed = UnpublishWriteSchema.safeParse(parseBookingBody(init));
    if (!parsed.success) return new Response(null, { status: 400 });
    return unpublishMockTarget(parsed.data.targetType, parsed.data.targetId) === "no_target" ? new Response(null, { status: 404 }) : Response.json({ ok: true });
  }
  if (url.pathname === "/api/moderation/ban" && init?.method === "POST") {
    if (!isMockModerator(mockDemoUser.id)) return new Response(null, { status: 403 });
    const parsed = BanOrganizerWriteSchema.safeParse(parseBookingBody(init));
    if (!parsed.success) return new Response(null, { status: 400 });
    return banMockOrganizer(parsed.data.userId) === "no_user" ? new Response(null, { status: 404 }) : Response.json({ ok: true });
  }
  if (url.pathname === "/api/reports" && init?.method === "POST") {
    const payload = parseBookingBody(init) as CreateReport | undefined;
    if (typeof payload !== "object" || payload === null || typeof payload.userId !== "string" || typeof payload.reason !== "string") return new Response(null, { status: 400 });
    const result = createMockReport(payload as CreateReport);
    return result === "no_target" ? new Response(null, { status: 404 }) : result === "invalid" ? new Response(null, { status: 400 }) : result === "duplicate" ? new Response(null, { status: 409 }) : Response.json(result);
  }
  return null;
}
