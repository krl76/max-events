// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for user participation statuses on events (P1 social layer).
// SCOPE: ParticipationStatus enum, Participation record and status-write schemas.
// DEPENDS: zod, ./primitives.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ParticipationStatusSchema - closed enum of 6 participation statuses
// - ParticipationStatus - participation status type
// - ParticipationSchema - full participation record (user + event + status + timestamps)
// - Participation - full participation type
// - SetParticipationStatusSchema - status write payload (user + event + status)
// - SetParticipationStatus - status write payload type
// END_MODULE_MAP

import { z } from "zod";
import { IdSchema, TimestampSchema } from "./primitives.js";

export const ParticipationStatusSchema = z.enum(["wants_to_go", "probably_going", "going", "looking_for_company", "looking_for_travel_buddy", "looking_for_after_event_company"]);
export type ParticipationStatus = z.infer<typeof ParticipationStatusSchema>;

export const ParticipationSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  eventId: IdSchema,
  status: ParticipationStatusSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type Participation = z.infer<typeof ParticipationSchema>;

export const SetParticipationStatusSchema = ParticipationSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type SetParticipationStatus = z.infer<typeof SetParticipationStatusSchema>;
