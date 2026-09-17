// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for the event waitlist (FIFO queue, timed confirmation offer).
// SCOPE: Waitlist status enum, WaitlistEntry, join payload, offer deadline.
// DEPENDS: zod, ./primitives.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - WaitlistStatusSchema - waiting/offered/confirmed/expired/cancelled
// - WaitlistEntrySchema - queue row with optional offer deadline
// - JoinWaitlistWriteSchema - join payload (eventId)
// END_MODULE_MAP

import { z } from "zod";
import { IdSchema, TimestampSchema } from "./primitives.js";

export const WaitlistStatusSchema = z.enum(["waiting", "offered", "confirmed", "expired", "cancelled"]);
export type WaitlistStatus = z.infer<typeof WaitlistStatusSchema>;

export const WaitlistEntrySchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  eventId: IdSchema,
  position: z.number().int().min(1),
  status: WaitlistStatusSchema,
  offeredUntil: TimestampSchema.nullable().default(null),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type WaitlistEntry = z.infer<typeof WaitlistEntrySchema>;

export const JoinWaitlistWriteSchema = z.object({
  eventId: IdSchema,
});
export type JoinWaitlistWrite = z.infer<typeof JoinWaitlistWriteSchema>;
