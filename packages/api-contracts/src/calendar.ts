// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for the personal calendar (active bookings split by event start).
// SCOPE: CalendarEntry and CalendarResponse envelopes reused by GET /api/calendar.
// DEPENDS: zod, ./booking.js, ./event.js, ./place.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CalendarEntrySchema - one active booking with its event and optional place
// - CalendarEntry - calendar entry type
// - CalendarResponseSchema - upcoming/past sections
// - CalendarResponse - calendar response type
// END_MODULE_MAP

import { z } from "zod";
import { BookingSchema } from "./booking.js";
import { EventSchema } from "./event.js";
import { PlaceSchema } from "./place.js";

export const CalendarEntrySchema = z.object({
  booking: BookingSchema,
  event: EventSchema,
  place: PlaceSchema.nullable(),
});
export type CalendarEntry = z.infer<typeof CalendarEntrySchema>;

export const CalendarResponseSchema = z.object({
  upcoming: z.array(CalendarEntrySchema),
  past: z.array(CalendarEntrySchema),
});
export type CalendarResponse = z.infer<typeof CalendarResponseSchema>;
