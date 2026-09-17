// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for page-view tracking and organizer event statistics.
// SCOPE: view write payload; per-event views/bookings/cancellations/paid bookings.
// DEPENDS: zod, ./primitives.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PageViewTargetSchema - event or place
// - PageViewTarget - target type
// - RecordPageViewWriteSchema - view write
// - RecordPageViewWrite - write type
// - OrganizerEventStatsSchema - aggregated counters
// - OrganizerEventStats - stats type
// END_MODULE_MAP

import { z } from "zod";
import { IdSchema } from "./primitives.js";

export const PageViewTargetSchema = z.enum(["event", "place"]);
export type PageViewTarget = z.infer<typeof PageViewTargetSchema>;

export const RecordPageViewWriteSchema = z.object({
  targetType: PageViewTargetSchema,
  targetId: IdSchema,
});
export type RecordPageViewWrite = z.infer<typeof RecordPageViewWriteSchema>;

export const OrganizerEventStatsSchema = z.object({
  eventId: IdSchema,
  views: z.number().int().min(0),
  bookings: z.number().int().min(0),
  cancellations: z.number().int().min(0),
  paidBookings: z.number().int().min(0),
});
export type OrganizerEventStats = z.infer<typeof OrganizerEventStatsSchema>;
