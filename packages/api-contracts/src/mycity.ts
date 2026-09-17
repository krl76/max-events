// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for "Мой город" — personal city history aggregates and memory map points.
// SCOPE: MyCitySummary counters (places/events/districts), MemoryPoint (geo point + event or place + when).
// DEPENDS: zod, ./primitives.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MyCitySummarySchema - personal history counters (places, events, new districts)
// - MyCitySummary - my city summary type
// - MemoryPointSchema - impression point for the personal map (geo + exactly one of eventId/placeId + visited time)
// - MemoryPoint - memory point type
// - MyCityPayloadSchema - GET /users/:id/my-city envelope
// - MyCityPayload - my-city payload type
// END_MODULE_MAP

import { z } from "zod";
import { IdSchema, TimestampSchema } from "./primitives.js";
import { LatitudeSchema, LongitudeSchema } from "./place.js";

export const MyCitySummarySchema = z.object({
  userId: IdSchema,
  placesCount: z.number().int().min(0),
  eventsCount: z.number().int().min(0),
  districtsCount: z.number().int().min(0),
});
export type MyCitySummary = z.infer<typeof MyCitySummarySchema>;

export const MemoryPointSchema = z
  .object({
    latitude: LatitudeSchema,
    longitude: LongitudeSchema,
    eventId: IdSchema.nullable().default(null),
    placeId: IdSchema.nullable().default(null),
    visitedAt: TimestampSchema,
  })
  .refine((data) => (data.eventId !== null) !== (data.placeId !== null), {
    message: "memory point must reference exactly one of eventId or placeId",
    path: ["eventId"],
  });
export type MemoryPoint = z.infer<typeof MemoryPointSchema>;

export const MyCityPayloadSchema = z.object({
  summary: MyCitySummarySchema,
  points: z.array(MemoryPointSchema),
});
export type MyCityPayload = z.infer<typeof MyCityPayloadSchema>;
