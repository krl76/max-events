// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for user reports (post-moderation queue).
// SCOPE: Report reason enum, report source, Report entity, create-report write payload over every post-moderated object (event, place, feed post, micro-event); unique (user, target) is a backend invariant.
// DEPENDS: zod, ./primitives.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ReportReasonSchema - closed report-reason enum
// - ReportReason - report reason type
// - ReportTargetTypeSchema - event/place/feed_post/micro_event
// - ReportTargetType - target type
// - ReportStatusSchema - open/resolved
// - ReportStatus - status type
// - ReportSourceSchema - user complaint or moderator spot check
// - ReportSource - source type
// - ReportSchema - report entity
// - Report - report type
// - CreateReportWriteSchema - report submission payload
// - CreateReportWrite - create payload type
// - UnpublishWriteSchema - unpublish payload
// - UnpublishWrite - unpublish type
// - BanOrganizerWriteSchema - ban payload
// - BanOrganizerWrite - ban type
// END_MODULE_MAP

import { z } from "zod";
import { IdSchema, TimestampSchema } from "./primitives.js";

export const ReportReasonSchema = z.enum(["spam", "abuse", "inaccurate", "inappropriate", "other"]);
export type ReportReason = z.infer<typeof ReportReasonSchema>;

export const ReportTargetTypeSchema = z.enum(["event", "place", "feed_post", "micro_event"]);
export type ReportTargetType = z.infer<typeof ReportTargetTypeSchema>;

export const ReportStatusSchema = z.enum(["open", "resolved"]);
export type ReportStatus = z.infer<typeof ReportStatusSchema>;

/** Who put the row in the queue: a user complaint, or a moderator pulling a publication for review. */
export const ReportSourceSchema = z.enum(["user", "spot_check"]);
export type ReportSource = z.infer<typeof ReportSourceSchema>;

export const ReportSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  targetType: ReportTargetTypeSchema,
  targetId: IdSchema,
  reason: ReportReasonSchema,
  status: ReportStatusSchema.default("open"),
  source: ReportSourceSchema.default("user"),
  createdAt: TimestampSchema,
});
export type Report = z.infer<typeof ReportSchema>;

export const CreateReportWriteSchema = z.object({
  eventId: IdSchema.optional(),
  placeId: IdSchema.optional(),
  feedPostId: IdSchema.optional(),
  microEventId: IdSchema.optional(),
  reason: ReportReasonSchema,
});
export type CreateReportWrite = z.infer<typeof CreateReportWriteSchema>;

export const UnpublishWriteSchema = z.object({
  targetType: ReportTargetTypeSchema,
  targetId: IdSchema,
});
export type UnpublishWrite = z.infer<typeof UnpublishWriteSchema>;

export const BanOrganizerWriteSchema = z.object({
  userId: IdSchema,
});
export type BanOrganizerWrite = z.infer<typeof BanOrganizerWriteSchema>;
