// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for organizer event-day options, attendance and waitlist invites (#545).
// SCOPE: OrganizerEventOptions, OrganizerAttendance, waitlist invite write/result. Not Event columns.
// DEPENDS: zod, ./primitives.js
// LINKS: M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OrganizerRecurrenceSchema - weekly repetition of an organizer event and the date it runs until
// - OrganizerRecurrence - recurrence type
// - OrganizerEventOptionsSchema - экран 46 switches
// - OrganizerEventOptions - event options type
// - UpdateOrganizerEventOptionsSchema - partial PATCH without field defaults
// - UpdateOrganizerEventOptions - options update type
// - OrganizerParticipantSchema - one person in the экран 47 roster
// - OrganizerParticipant - roster row type
// - OrganizerWaitlistRowSchema - one waiting person with their place in the queue
// - OrganizerWaitlistRow - waitlist row type
// - OrganizerSlotChipSchema - one time slot of the day with its busy flag
// - OrganizerSlotChip - slot chip type
// - OrganizerAttendanceSchema - экран 47 roster
// - OrganizerAttendance - attendance type
// - WaitlistInviteWriteSchema - invite someone off the waitlist
// - WaitlistInviteWrite - invite payload type
// - WaitlistInviteResultSchema - what the invite did
// - WaitlistInviteResult - invite result type
// END_MODULE_MAP

import { z } from "zod";
import { IdSchema, TimestampSchema } from "./primitives.js";

export const OrganizerRecurrenceSchema = z.object({
  rule: z.literal("weekly"),
  until: TimestampSchema,
});
export type OrganizerRecurrence = z.infer<typeof OrganizerRecurrenceSchema>;

export const OrganizerEventOptionsSchema = z.object({
  eventId: IdSchema,
  waitlistEnabled: z.boolean(),
  registrationInApp: z.boolean(),
  externalUrl: z.string().url().nullable(),
  recurrence: OrganizerRecurrenceSchema.nullable(),
});
export type OrganizerEventOptions = z.infer<typeof OrganizerEventOptionsSchema>;

export const UpdateOrganizerEventOptionsSchema = z.object({
  waitlistEnabled: z.boolean().optional(),
  registrationInApp: z.boolean().optional(),
  externalUrl: z.string().url().nullable().optional(),
  recurrence: OrganizerRecurrenceSchema.nullable().optional(),
});
export type UpdateOrganizerEventOptions = z.infer<typeof UpdateOrganizerEventOptionsSchema>;

export const OrganizerParticipantSchema = z.object({
  bookingId: IdSchema,
  userId: IdSchema,
  name: z.string().min(1),
  guests: z.number().int().min(0),
  checkedInAt: TimestampSchema.nullable(),
  bookedAt: TimestampSchema,
});
export type OrganizerParticipant = z.infer<typeof OrganizerParticipantSchema>;

export const OrganizerWaitlistRowSchema = z.object({
  entryId: IdSchema,
  userId: IdSchema,
  name: z.string().min(1),
  guests: z.number().int().min(0),
  joinedAt: TimestampSchema,
});
export type OrganizerWaitlistRow = z.infer<typeof OrganizerWaitlistRowSchema>;

export const OrganizerSlotChipSchema = z.object({
  id: IdSchema,
  startsAt: TimestampSchema,
  endsAt: TimestampSchema,
  busy: z.boolean(),
});
export type OrganizerSlotChip = z.infer<typeof OrganizerSlotChipSchema>;

export const OrganizerAttendanceSchema = z.object({
  eventId: IdSchema,
  capacity: z.number().int().min(0).nullable(),
  bookedCount: z.number().int().min(0),
  waitlistCount: z.number().int().min(0),
  checkedInCount: z.number().int().min(0),
  freedSeats: z.number().int().min(0),
  chatMessages: z.number().int().min(0).nullable(),
  participants: z.array(OrganizerParticipantSchema),
  waitlist: z.array(OrganizerWaitlistRowSchema),
  slots: z.array(OrganizerSlotChipSchema),
});
export type OrganizerAttendance = z.infer<typeof OrganizerAttendanceSchema>;

export const WaitlistInviteWriteSchema = z.object({
  count: z.number().int().positive().max(50),
});
export type WaitlistInviteWrite = z.infer<typeof WaitlistInviteWriteSchema>;

export const WaitlistInviteResultSchema = z.object({
  invited: z.number().int().min(0),
});
export type WaitlistInviteResult = z.infer<typeof WaitlistInviteResultSchema>;
