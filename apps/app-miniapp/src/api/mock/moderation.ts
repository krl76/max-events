// START_MODULE_CONTRACT
// PURPOSE: Mock moderation store: the deduplicated reports, the moderator allowlist and the two irreversible actions.
// SCOPE: Report state, the moderator gate and what unpublishing hides; the HTTP surface is in ./moderation.routes.ts.
// DEPENDS: @max-events/api-contracts, ../client.js and the sibling ./mock domain modules it imports
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - resetMockReports - clear in-memory reports and bans, republish what moderation hid (test isolation)
// - createMockReport - in-memory deduplicated report (mock POST /reports, duplicate -> 409, unknown target -> "no_target")
// - MOCK_MODERATOR_USER_ID - the demo user, standing in for MODERATOR_MAX_USER_IDS
// - setMockModerator - put the demo user in or out of MODERATOR_MAX_USER_IDS (demo / tests)
// - isMockModerator - whether this viewer may see the moderation queue
// - openMockReports - mock GET /reports?status=open
// - resolveMockReport - mock POST /reports/:id/resolve
// - unpublishMockTarget - mock POST /moderation/unpublish
// - bannedMockOrganizers - who the mock has banned (test isolation)
// - banMockOrganizer - mock POST /moderation/ban
// END_MODULE_MAP

import type { ReportTargetType } from "@max-events/api-contracts";
import { REPORT_REASONS, type CreateReport, type Report } from "../client";
import { mockFeedPosts, seedMockFeed } from "./feed";
import { mockDemoUser, mockEvents, mockFriends, mockOrganizers, mockPlaces } from "./fixtures";
import { mockMicroEvents, seedMockMicroEvents } from "./social";

const mockReports: Report[] = [];

const mockUnpublishedByModeration = new Set<string>();

let mockModerationRemovedFeed = false;

let mockModerationRemovedMicro = false;

let mockReportSeq = 0;

export function resetMockReports(): void {
  // Undo exactly what moderation unpublished, and nothing else: the organizer fixtures keep their own drafts.
  for (const row of [...mockEvents, ...mockPlaces]) if (mockUnpublishedByModeration.has(row.id)) row.published = true;
  mockUnpublishedByModeration.clear();
  // Feed posts and micro-events carry no published flag here, so hiding them meant dropping them:
  // putting them back means re-seeding, and only when moderation was the one that took them away.
  if (mockModerationRemovedFeed) seedMockFeed();
  if (mockModerationRemovedMicro) seedMockMicroEvents();
  mockModerationRemovedFeed = false;
  mockModerationRemovedMicro = false;
  mockBannedOrganizers.clear();
  mockModeratorEnabled = true;
  mockReports.length = 0;
  mockReportSeq = 0;
}

/** Creates a report for exactly one known event/place/feed post; a repeat report of the same user for the same target returns "duplicate" (mock 409), 0 or >1 targets — "invalid", an unknown target or reason — "no_target"/"invalid". */
export function createMockReport(payload: CreateReport): Report | "duplicate" | "no_target" | "invalid" {
  const targetCount = [payload.eventId, payload.placeId, payload.feedPostId].filter((id) => id !== undefined).length;
  if (targetCount !== 1) return "invalid";
  const targetType = payload.eventId !== undefined ? "event" : payload.placeId !== undefined ? "place" : "feed_post";
  const targetId = payload.eventId ?? payload.placeId ?? payload.feedPostId!;
  const known = payload.eventId !== undefined ? mockEvents.some((item) => item.id === payload.eventId) : payload.placeId !== undefined ? mockPlaces.some((item) => item.id === payload.placeId) : mockFeedPosts.some((item) => item.id === payload.feedPostId);
  if (!known) return "no_target";
  if (!REPORT_REASONS.includes(payload.reason)) return "invalid";
  if (mockReports.some((item) => item.userId === payload.userId && item.targetId === targetId)) return "duplicate";
  mockReportSeq += 1;
  const report: Report = { id: `81000000-0000-4000-8000-${String(mockReportSeq).padStart(12, "0")}`, userId: payload.userId, targetType, targetId, reason: payload.reason, status: "open", source: "user", createdAt: new Date().toISOString() };
  mockReports.push(report);
  return report;
}

/**
 * The real gate is MODERATOR_MAX_USER_IDS on the backend, which the mock has no access to. The demo
 * user stands in for a moderator so the queue can be seen at all; everyone else gets the same 403.
 */
export const MOCK_MODERATOR_USER_ID = "a0000000-0000-4000-8000-000000000001";

/**
 * The demo user stands in for MODERATOR_MAX_USER_IDS, so the queue is demonstrable without a backend.
 * The other half of the feature — a regular viewer, for whom the screen does not exist — needs the
 * demo user to step out of the list, which is what this switch is for.
 */
let mockModeratorEnabled = true;

export function setMockModerator(enabled: boolean): void {
  mockModeratorEnabled = enabled;
}

export function isMockModerator(userId: string): boolean {
  return mockModeratorEnabled && userId === MOCK_MODERATOR_USER_ID;
}

/** Mock GET /reports?status=open. */
export function openMockReports(): Report[] {
  return mockReports.filter((row) => row.status === "open");
}

/** Mock POST /reports/:id/resolve; null when the report is unknown. */
export function resolveMockReport(reportId: string): Report | null {
  const report = mockReports.find((row) => row.id === reportId);
  if (!report) return null;
  report.status = "resolved";
  return report;
}

/** Mock POST /moderation/unpublish: the row stops being served, the way the backend unpublishes it. */
export function unpublishMockTarget(targetType: ReportTargetType, targetId: string): "ok" | "no_target" {
  if (targetType === "event") {
    const event = mockEvents.find((row) => row.id === targetId);
    if (!event) return "no_target";
    event.published = false;
    mockUnpublishedByModeration.add(event.id);
    return "ok";
  }
  if (targetType === "feed_post") {
    const index = mockFeedPosts.findIndex((row) => row.id === targetId);
    if (index === -1) return "no_target";
    mockFeedPosts.splice(index, 1);
    mockModerationRemovedFeed = true;
    return "ok";
  }
  if (targetType === "place") {
    const place = mockPlaces.find((row) => row.id === targetId);
    if (!place) return "no_target";
    place.published = false;
    mockUnpublishedByModeration.add(place.id);
    return "ok";
  }
  // The micro-event DTO carries no published flag, so hiding it means dropping it from what the mock serves.
  const index = mockMicroEvents.findIndex((row) => row.id === targetId);
  if (index === -1) return "no_target";
  mockMicroEvents.splice(index, 1);
  mockModerationRemovedMicro = true;
  return "ok";
}

const mockBannedOrganizers = new Set<string>();

export function bannedMockOrganizers(): string[] {
  return [...mockBannedOrganizers];
}

/** Mock POST /moderation/ban. */
export function banMockOrganizer(userId: string): "ok" | "no_user" {
  const known = mockOrganizers.some((row) => row.id === userId) || mockFriends.some((row) => row.id === userId) || userId === mockDemoUser.id;
  if (!known) return "no_user";
  mockBannedOrganizers.add(userId);
  return "ok";
}
