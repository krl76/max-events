// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for the check-in flow ("Я здесь") and personal visit statistics.
// SCOPE: CheckIn entity (event or place + time), visit stats counters by place/event/category.
// DEPENDS: zod, ./primitives.js, ./event.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CheckInSchema - check-in entity referencing exactly one of eventId or placeId with the time
// - CheckIn - check-in type
// - CategoryVisitCountSchema - visit counter for one event category
// - CategoryVisitCount - category visit counter type
// - VisitStatsSchema - user visit statistics (places/events totals + per-category counters)
// - VisitStats - visit stats type
// - CreateCheckInWriteSchema - write payload with exactly one of eventId or placeId
// - CreateCheckInWrite - write payload type
// END_MODULE_MAP

import { z } from "zod";
import { IdSchema, TimestampSchema } from "./primitives.js";
import { EventCategorySchema } from "./event.js";

export const CheckInSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
    eventId: IdSchema.nullable().default(null),
    placeId: IdSchema.nullable().default(null),
    checkedInAt: TimestampSchema,
  })
  .refine((data) => (data.eventId !== null) !== (data.placeId !== null), {
    message: "check-in must reference exactly one of eventId or placeId",
    path: ["eventId"],
  });
export type CheckIn = z.infer<typeof CheckInSchema>;

export const CategoryVisitCountSchema = z.object({
  category: EventCategorySchema,
  count: z.number().int().min(0),
});
export type CategoryVisitCount = z.infer<typeof CategoryVisitCountSchema>;

export const VisitStatsSchema = z.object({
  userId: IdSchema,
  placesCount: z.number().int().min(0),
  eventsCount: z.number().int().min(0),
  byCategory: z.array(CategoryVisitCountSchema).default([]),
});
export type VisitStats = z.infer<typeof VisitStatsSchema>;

export const CreateCheckInWriteSchema = z
  .object({
    eventId: IdSchema.optional(),
    placeId: IdSchema.optional(),
  })
  .refine((data) => (data.eventId !== undefined) !== (data.placeId !== undefined), {
    message: "check-in must reference exactly one of eventId or placeId",
    path: ["eventId"],
  });
export type CreateCheckInWrite = z.infer<typeof CreateCheckInWriteSchema>;
