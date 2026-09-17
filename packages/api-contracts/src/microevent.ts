// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for user-created micro-events (UGC) — "Играем в баскетбол сегодня в 19:00, сейчас 3/6".
// SCOPE: MicroEvent status enum, MicroEvent entity (what/when/where, participant limit and count, author).
// DEPENDS: zod, ./primitives.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MicroEventStatusSchema - closed micro-event status enum (open/cancelled)
// - MicroEventStatus - micro-event status type
// - MicroEventSchema - micro-event entity (title, startsAt, text or place location, limit/count, author)
// - MicroEvent - micro-event type
// - CreateMicroEventWriteSchema - create payload
// - CreateMicroEventWrite - create payload type
// END_MODULE_MAP

import { z } from "zod";
import { IdSchema, TimestampSchema } from "./primitives.js";

export const MicroEventStatusSchema = z.enum(["open", "cancelled"]);
export type MicroEventStatus = z.infer<typeof MicroEventStatusSchema>;

export const MicroEventSchema = z
  .object({
    id: IdSchema,
    authorId: IdSchema,
    title: z.string().min(1).max(200),
    startsAt: TimestampSchema,
    locationText: z.string().min(1).max(300).nullable().default(null),
    placeId: IdSchema.nullable().default(null),
    participantsLimit: z.number().int().min(1),
    participantsCount: z.number().int().min(0).default(0),
    status: MicroEventStatusSchema,
    createdAt: TimestampSchema,
  })
  .refine((data) => (data.locationText !== null) !== (data.placeId !== null), {
    message: "micro-event location must be exactly one of locationText or placeId",
    path: ["locationText"],
  })
  .refine((data) => data.participantsCount <= data.participantsLimit, {
    message: "participantsCount cannot exceed participantsLimit",
    path: ["participantsCount"],
  });
export type MicroEvent = z.infer<typeof MicroEventSchema>;

export const CreateMicroEventWriteSchema = z
  .object({
    title: z.string().min(1).max(200),
    startsAt: TimestampSchema,
    locationText: z.string().min(1).max(300).nullable().optional(),
    placeId: IdSchema.nullable().optional(),
    participantsLimit: z.number().int().min(1),
  })
  .refine((data) => (data.locationText != null) !== (data.placeId != null), {
    message: "micro-event location must be exactly one of locationText or placeId",
    path: ["locationText"],
  });
export type CreateMicroEventWrite = z.infer<typeof CreateMicroEventWriteSchema>;
