// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for the «Рядом со мной» timeline and free-window leisure options.
// SCOPE: Nearby time buckets, nearby event cards with distance, leisure option chains.
// DEPENDS: zod, ./event.js, ./place.js, ./primitives.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - NearbyBucketSchema - now / inAnHour / evening / tomorrow
// - NearbyBucket - bucket type
// - NearbyCardSchema - event + place + distanceKm
// - NearbyCard - nearby card type
// - NearbyTimelineSchema - four-bucket GET /nearby payload
// - NearbyTimeline - timeline type
// - LeisureMoodSchema - relax / active / friends
// - LeisureMood - mood type
// - LeisureStopSchema - one stop in a leisure chain
// - LeisureStop - stop type
// - LeisureOptionSchema - chain of places/events for a free window
// - LeisureOption - leisure option type
// END_MODULE_MAP

import { z } from "zod";
import { EventSchema } from "./event.js";
import { PlaceSchema } from "./place.js";
import { IdSchema } from "./primitives.js";

export const NearbyBucketSchema = z.enum(["now", "inAnHour", "evening", "tomorrow"]);
export type NearbyBucket = z.infer<typeof NearbyBucketSchema>;

export const NearbyCardSchema = z.object({
  event: EventSchema,
  place: PlaceSchema,
  distanceKm: z.number().nonnegative(),
  bucket: NearbyBucketSchema,
  promoted: z.boolean().default(false),
});
export type NearbyCard = z.infer<typeof NearbyCardSchema>;

export const NearbyTimelineSchema = z.object({
  now: z.array(NearbyCardSchema),
  inAnHour: z.array(NearbyCardSchema),
  evening: z.array(NearbyCardSchema),
  tomorrow: z.array(NearbyCardSchema),
});
export type NearbyTimeline = z.infer<typeof NearbyTimelineSchema>;

export const LeisureMoodSchema = z.enum(["relax", "active", "friends"]);
export type LeisureMood = z.infer<typeof LeisureMoodSchema>;

export const LeisureStopSchema = z.object({
  kind: z.enum(["place", "event"]),
  placeId: IdSchema.nullable().default(null),
  eventId: IdSchema.nullable().default(null),
  title: z.string().min(1),
  startsAt: z.string().nullable().default(null),
  distanceKm: z.number().nonnegative().nullable().default(null),
  priceRub: z.number().int().nonnegative().nullable().default(null),
});
export type LeisureStop = z.infer<typeof LeisureStopSchema>;

export const LeisureOptionSchema = z.object({
  mood: LeisureMoodSchema,
  title: z.string().min(1),
  stops: z.array(LeisureStopSchema).min(1),
});
export type LeisureOption = z.infer<typeof LeisureOptionSchema>;
