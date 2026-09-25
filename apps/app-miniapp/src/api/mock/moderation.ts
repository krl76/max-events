// START_MODULE_CONTRACT
// PURPOSE: Mock moderation store: the deduplicated reports, the moderator spot checks, what each queue row is about, the moderator allowlist and the two irreversible actions.
// SCOPE: Report state, the moderator gate, target resolution and what unpublishing hides; the HTTP surface is in ./moderation.routes.ts.
// DEPENDS: @max-events/api-contracts, ../client.js and the sibling ./mock domain modules it imports
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - resetMockReports - clear in-memory reports and bans, republish what moderation hid, re-seed the demo queue (test isolation)
// - createMockReport - in-memory deduplicated report (mock POST /reports, duplicate -> 409, unknown target -> "no_target")
// - spotCheckMockReport - mock POST /reports/spot-check: a moderator pulling a publication for review, the queue's second stream
// - MOCK_MODERATOR_USER_ID - the demo user, standing in for MODERATOR_MAX_USER_IDS
// - setMockModerator - put the demo user in or out of MODERATOR_MAX_USER_IDS (demo / tests)
// - isMockModerator - whether this viewer may see the moderation queue
// - openMockReports - mock GET /reports?status=open
// - mockModerationTargets - mock GET /moderation/targets: one row per reported object, resolved while it is still readable
// - resolveMockReport - mock POST /reports/:id/resolve
// - unpublishMockTarget - mock POST /moderation/unpublish
// - bannedMockOrganizers - who the mock has banned (test isolation)
// - banMockOrganizer - mock POST /moderation/ban
// END_MODULE_MAP

import type { ReportTargetType } from "@max-events/api-contracts";
import { REPORT_REASONS, type CreateReport, type ModerationTarget, type Report } from "../client";
import { mockBookings } from "./bookings";
import { mockFeedPosts, seedMockFeed } from "./feed";
import { mockDemoUser, mockEvents, mockFriendIds, mockFriends, mockOrganizers, mockPlaces } from "./fixtures";
import { organizerEvents } from "./organizer";
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
  seedMockModerationQueue();
}

/**
 * The demo queue of экраны 46 и 47. It is seeded only in mock mode: under vitest every report a test
 * needs is the one it creates itself, and a pre-filled queue would be a fixture no test asked for.
 * Authors are friends, never the demo user, so a user-side report of the same target is never a duplicate.
 */
function seedMockModerationQueue(): void {
  if (import.meta.env.VITE_USE_MOCK !== "1") return;
  // hoursAgo spreads the stamps so «сегодня · вчера · дата» of экран 47 has all three shapes to show.
  const complaints: Array<{ author: number; target: Partial<CreateReport>; reason: CreateReport["reason"]; hoursAgo: number }> = [
    { author: 0, target: { eventId: mockEvents[5]?.id }, reason: "inaccurate", hoursAgo: 2 },
    { author: 1, target: { eventId: mockEvents[5]?.id }, reason: "inaccurate", hoursAgo: 15 },
    { author: 2, target: { eventId: mockEvents[5]?.id }, reason: "other", hoursAgo: 60 },
    { author: 3, target: { feedPostId: mockFeedPosts[0]?.id }, reason: "spam", hoursAgo: 5 },
    { author: 4, target: { feedPostId: mockFeedPosts[0]?.id }, reason: "spam", hoursAgo: 30 },
    { author: 5, target: { placeId: mockPlaces[4]?.id }, reason: "inaccurate", hoursAgo: 8 },
  ];
  const now = Date.now();
  const at = (hoursAgo: number) => new Date(now - hoursAgo * 3_600_000).toISOString();
  for (const row of complaints) {
    if (Object.values(row.target)[0] === undefined) continue;
    createMockReport({ userId: mockFriendIds[row.author], reason: row.reason, ...row.target }, at(row.hoursAgo));
  }
  // The second stream: a moderator pulling a first-time publication for review, not a complaint.
  if (mockEvents[4]) spotCheckMockReport({ userId: MOCK_MODERATOR_USER_ID, eventId: mockEvents[4].id, reason: "other" }, at(3));
  if (mockMicroEvents[0]) spotCheckMockReport({ userId: MOCK_MODERATOR_USER_ID, microEventId: mockMicroEvents[0].id, reason: "inappropriate" }, at(20));
}

/** The one target a payload names, with whether the mock knows it; null when the payload names 0 or more than 1. */
function mockReportTarget(payload: CreateReport): { targetType: ReportTargetType; targetId: string; known: boolean } | null {
  const named = [
    { targetType: "event" as const, targetId: payload.eventId, known: () => mockEvents.some((item) => item.id === payload.eventId) || organizerEvents().some((item) => item.id === payload.eventId) },
    { targetType: "place" as const, targetId: payload.placeId, known: () => mockPlaces.some((item) => item.id === payload.placeId) },
    { targetType: "feed_post" as const, targetId: payload.feedPostId, known: () => mockFeedPosts.some((item) => item.id === payload.feedPostId) },
    { targetType: "micro_event" as const, targetId: payload.microEventId, known: () => mockMicroEvents.some((item) => item.id === payload.microEventId) },
  ].filter((row) => row.targetId !== undefined);
  if (named.length !== 1) return null;
  return { targetType: named[0].targetType, targetId: named[0].targetId!, known: named[0].known() };
}

function pushMockReport(payload: CreateReport, source: Report["source"], createdAt: string): Report | "duplicate" | "no_target" | "invalid" {
  const target = mockReportTarget(payload);
  if (target === null) return "invalid";
  if (!target.known) return "no_target";
  if (!REPORT_REASONS.includes(payload.reason)) return "invalid";
  if (mockReports.some((item) => item.userId === payload.userId && item.targetId === target.targetId)) return "duplicate";
  mockReportSeq += 1;
  const report: Report = { id: `81000000-0000-4000-8000-${String(mockReportSeq).padStart(12, "0")}`, userId: payload.userId, targetType: target.targetType, targetId: target.targetId, reason: payload.reason, status: "open", source, createdAt };
  mockReports.push(report);
  return report;
}

/** Creates a report for exactly one known event/place/feed post/micro-event; a repeat report of the same user for the same target returns "duplicate" (mock 409), 0 or >1 targets — "invalid", an unknown target or reason — "no_target"/"invalid". */
export function createMockReport(payload: CreateReport, createdAt: string = new Date().toISOString()): Report | "duplicate" | "no_target" | "invalid" {
  return pushMockReport(payload, "user", createdAt);
}

/** Mock POST /reports/spot-check: the same row with source=spot_check — the queue's other stream, never mixed with complaints. */
export function spotCheckMockReport(payload: CreateReport, createdAt: string = new Date().toISOString()): Report | "duplicate" | "no_target" | "invalid" {
  return pushMockReport(payload, "spot_check", createdAt);
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

function friendName(userId: string): string | null {
  return mockFriends.find((friend) => friend.id === userId)?.name ?? null;
}

/**
 * One row per reported object, resolved from the fixtures while the object is still published: after a
 * sanction it stops being served, and the разбор screen would have nothing left to name.
 */
export function mockModerationTargets(): ModerationTarget[] {
  const seen = new Map<string, ModerationTarget>();
  for (const report of openMockReports()) {
    const key = `${report.targetType}:${report.targetId}`;
    if (seen.has(key)) continue;
    const resolved = resolveMockTarget(report.targetType, report.targetId);
    if (resolved !== null) seen.set(key, resolved);
  }
  return [...seen.values()];
}

function resolveMockTarget(targetType: ReportTargetType, targetId: string): ModerationTarget | null {
  if (targetType === "event") {
    const catalog = mockEvents.find((item) => item.id === targetId);
    const own = catalog ?? organizerEvents().find((item) => item.id === targetId);
    if (!own) return null;
    // The ownership convention of the fixtures: catalog events belong to the fixture organizer, the panel ones to the demo user.
    const organizerId = catalog ? mockOrganizers[0].id : mockDemoUser.id;
    const organizer = catalog ? `${mockOrganizers[0].firstName} ${mockOrganizers[0].lastName ?? ""}`.trim() : "Вы";
    return { targetType, targetId, title: own.title, subtitle: own.city, organizerId, organizerName: organizer, reachCount: mockBookings.filter((booking) => booking.eventId === targetId && booking.status === "active").length };
  }
  if (targetType === "place") {
    const found = mockPlaces.find((item) => item.id === targetId);
    return found ? { targetType, targetId, title: found.title, subtitle: found.address, organizerId: null, organizerName: null, reachCount: null } : null;
  }
  if (targetType === "feed_post") {
    const found = mockFeedPosts.find((item) => item.id === targetId);
    return found ? { targetType, targetId, title: `«${found.text}»`, subtitle: found.author.name, organizerId: found.author.id, organizerName: found.author.name, reachCount: found.likesCount } : null;
  }
  const found = mockMicroEvents.find((item) => item.id === targetId);
  return found ? { targetType, targetId, title: found.title, subtitle: found.locationText, organizerId: found.authorId, organizerName: friendName(found.authorId), reachCount: found.participantsCount } : null;
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

// Демо-очередь собирается после объявления всех фикстур: до этой строки посты ленты и микро-события ещё не засеяны.
seedMockModerationQueue();
