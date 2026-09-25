// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for the personal calendar (active bookings split by event start) and the calendar shared with a friend.
// SCOPE: CalendarEntry and CalendarResponse envelopes reused by GET /api/calendar; SharedCalendar for GET /api/calendar/shared.
// DEPENDS: zod, ./booking.js, ./event.js, ./friends.js, ./place.js, ./primitives.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CalendarEntrySchema - one active booking with its event and optional place
// - CalendarEntry - calendar entry type
// - CalendarResponseSchema - upcoming/past sections
// - CalendarResponse - calendar response type
// - SharedCalendarPeerSchema - a friend the calendar is shared with and whether they may edit
// - SharedCalendarPeer - shared-calendar peer type
// - SharedCalendarEntrySchema - one peer booking projected onto the shared calendar
// - SharedCalendarEntry - shared-calendar entry type
// - SharedCalendarSchema - peers, their records and the invite link
// - SharedCalendar - shared calendar type
// - AddCalendarPeerWriteSchema - POST /calendar/shared/peers body
// - AddCalendarPeerWrite - add-peer payload type
// - AcceptCalendarInviteWriteSchema - POST /calendar/shared/accept body
// - AcceptCalendarInviteWrite - accept-invite payload type
// END_MODULE_MAP

import { z } from "zod";
import { BookingSchema } from "./booking.js";
import { EventSchema } from "./event.js";
import { FriendSchema } from "./friends.js";
import { PlaceSchema } from "./place.js";
import { IdSchema, TimestampSchema } from "./primitives.js";

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

export const SharedCalendarPeerSchema = z.object({
  friend: FriendSchema,
  canEdit: z.boolean(),
});
export type SharedCalendarPeer = z.infer<typeof SharedCalendarPeerSchema>;

export const SharedCalendarEntrySchema = z.object({
  id: IdSchema,
  owner: FriendSchema,
  title: z.string().min(1).max(200),
  startsAt: TimestampSchema,
  endsAt: TimestampSchema.nullable(),
  bothGoing: z.boolean(),
  needsResponse: z.boolean(),
  eventId: IdSchema.nullable(),
});
export type SharedCalendarEntry = z.infer<typeof SharedCalendarEntrySchema>;

export const SharedCalendarSchema = z.object({
  peers: z.array(SharedCalendarPeerSchema),
  entries: z.array(SharedCalendarEntrySchema),
  inviteUrl: z.string().min(1).nullable(),
});
export type SharedCalendar = z.infer<typeof SharedCalendarSchema>;

export const AddCalendarPeerWriteSchema = z.object({
  userId: IdSchema,
  canEdit: z.boolean().optional(),
});
export type AddCalendarPeerWrite = z.infer<typeof AddCalendarPeerWriteSchema>;

export const AcceptCalendarInviteWriteSchema = z.object({
  token: IdSchema,
});
export type AcceptCalendarInviteWrite = z.infer<typeof AcceptCalendarInviteWriteSchema>;
