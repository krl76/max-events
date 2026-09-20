// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for the company gathering flow ("Собрать компанию") and friend availability.
// SCOPE: Friend availability, invitee response enum, gathering status, Gathering entity.
// DEPENDS: zod, ./primitives.js, ./event.js, ./friends.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - FriendAvailabilitySchema - friend free/busy/unknown for an event time
// - FriendAvailability - friend availability type
// - InviteeResponseSchema - closed invitee response enum (accepted/considering/busy)
// - InviteeResponse - invitee response type
// - InviteeSchema - invited friend with their response
// - Invitee - invitee type
// - GatheringStatusSchema - closed gathering status enum
// - GatheringStatus - gathering status type
// - GatheringSchema - gathering entity (event + invitees + proposed meeting time + status + optional chat link)
// - Gathering - gathering type
// - CreateGatheringSchema - launch payload (event + friend ids + proposed meeting time)
// - CreateGathering - launch payload type
// - GatheringResponseWriteSchema - invitee answer body
// - GatheringResponseWrite - invitee answer body type
// END_MODULE_MAP

import { z } from "zod";
import { IdSchema, TimestampSchema } from "./primitives.js";
import { EventSchema } from "./event.js";
import { FriendSchema } from "./friends.js";

export const FriendAvailabilitySchema = z.object({
  friend: FriendSchema,
  availability: z.enum(["free", "busy", "unknown"]),
});
export type FriendAvailability = z.infer<typeof FriendAvailabilitySchema>;

export const InviteeResponseSchema = z.enum(["accepted", "considering", "busy"]);
export type InviteeResponse = z.infer<typeof InviteeResponseSchema>;

export const InviteeSchema = z.object({
  friend: FriendSchema,
  response: InviteeResponseSchema,
});
export type Invitee = z.infer<typeof InviteeSchema>;

export const GatheringStatusSchema = z.enum(["draft", "awaiting_responses", "confirmed", "cancelled"]);
export type GatheringStatus = z.infer<typeof GatheringStatusSchema>;

export const GatheringSchema = z.object({
  id: IdSchema,
  event: EventSchema,
  invitees: z.array(InviteeSchema),
  proposedMeetingAt: TimestampSchema,
  status: GatheringStatusSchema,
  chatLink: z.string().nullable().default(null),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type Gathering = z.infer<typeof GatheringSchema>;

export const CreateGatheringSchema = z.object({
  eventId: IdSchema,
  friendIds: z.array(IdSchema).min(1),
  proposedMeetingAt: TimestampSchema,
});
export type CreateGathering = z.infer<typeof CreateGatheringSchema>;

export const GatheringResponseWriteSchema = z.object({
  response: InviteeResponseSchema,
});
export type GatheringResponseWrite = z.infer<typeof GatheringResponseWriteSchema>;
