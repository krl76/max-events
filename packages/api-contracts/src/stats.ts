// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for page-view tracking and organizer event statistics.
// SCOPE: view write payload; the reporting period; per-event views/bookings/cancellations/paid bookings over that period.
// DEPENDS: zod, ./primitives.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PageViewTargetSchema - event or place
// - PageViewTarget - target type
// - RecordPageViewWriteSchema - view write
// - RecordPageViewWrite - write type
// - StatsPeriodSchema - inclusive from/to window, null on either side meaning open-ended
// - StatsPeriod - period type
// - OrganizerEventStatsSchema - aggregated counters plus the period they cover
// - OrganizerEventStats - stats type
// - OrganizerTrafficSourceSchema - where a booking came from: chats, feed or search
// - OrganizerTrafficSource - traffic source type
// - OrganizerTrafficShareSchema - one source and its percentage of the whole
// - OrganizerTrafficShare - traffic share type
// - OrganizerLeadBucketSchema - how far ahead of the event a booking was made
// - OrganizerLeadBucket - lead bucket type
// - OrganizerLeadShareSchema - one lead bucket and its percentage of dated bookings
// - OrganizerLeadShare - lead share type
// - OrganizerSummarySchema - organizer dashboard: bookings, funnel, occupancy, guests, lead time, waitlist, weekday spread and traffic sources
// - OrganizerSummary - organizer summary type
// END_MODULE_MAP

import { z } from "zod";
import { IdSchema, TimestampSchema } from "./primitives.js";

export const PageViewTargetSchema = z.enum(["event", "place"]);
export type PageViewTarget = z.infer<typeof PageViewTargetSchema>;

export const RecordPageViewWriteSchema = z.object({
  targetType: PageViewTargetSchema,
  targetId: IdSchema,
});
export type RecordPageViewWrite = z.infer<typeof RecordPageViewWriteSchema>;

/** The window a report covers. Both sides null is "all time"; either side alone is open-ended. */
export const StatsPeriodSchema = z
  .object({
    from: TimestampSchema.nullable().default(null),
    to: TimestampSchema.nullable().default(null),
  })
  .refine((data) => data.from === null || data.to === null || new Date(data.from).getTime() <= new Date(data.to).getTime(), {
    message: "period from must not be after to",
    path: ["from"],
  });
export type StatsPeriod = z.infer<typeof StatsPeriodSchema>;

export const OrganizerEventStatsSchema = z.object({
  eventId: IdSchema,
  period: StatsPeriodSchema.default({ from: null, to: null }),
  views: z.number().int().min(0),
  bookings: z.number().int().min(0),
  cancellations: z.number().int().min(0),
  paidBookings: z.number().int().min(0),
});
export type OrganizerEventStats = z.infer<typeof OrganizerEventStatsSchema>;

export const OrganizerTrafficSourceSchema = z.enum(["chats", "feed", "search"]);
export type OrganizerTrafficSource = z.infer<typeof OrganizerTrafficSourceSchema>;

export const OrganizerTrafficShareSchema = z.object({
  source: OrganizerTrafficSourceSchema,
  percent: z.number().min(0).max(100),
});
export type OrganizerTrafficShare = z.infer<typeof OrganizerTrafficShareSchema>;

export const OrganizerLeadBucketSchema = z.enum(["same_day", "days_1_3", "days_4_7", "earlier"]);
export type OrganizerLeadBucket = z.infer<typeof OrganizerLeadBucketSchema>;

export const OrganizerLeadShareSchema = z.object({
  bucket: OrganizerLeadBucketSchema,
  percent: z.number().min(0).max(100),
});
export type OrganizerLeadShare = z.infer<typeof OrganizerLeadShareSchema>;

export const OrganizerSummarySchema = z.object({
  bookings: z.number().int().min(0),
  bookingsDeltaPercent: z.number().nullable(),
  attendedPercent: z.number().nullable(),
  cancelledPercent: z.number().nullable(),
  byWeekday: z.array(z.number().int().min(0)).length(7),
  sources: z.array(OrganizerTrafficShareSchema),
  views: z.number().int().min(0),
  conversionPercent: z.number().nullable(),
  occupancyPercent: z.number().nullable(),
  seatsBooked: z.number().int().min(0),
  seatsCapacity: z.number().int().min(0),
  events: z.number().int().min(0),
  soldOut: z.number().int().min(0),
  uniqueGuests: z.number().int().min(0),
  repeatGuestPercent: z.number().nullable(),
  newGuestPercent: z.number().nullable(),
  waitlist: z.number().int().min(0),
  lead: z.array(OrganizerLeadShareSchema).length(4),
});
export type OrganizerSummary = z.infer<typeof OrganizerSummarySchema>;
