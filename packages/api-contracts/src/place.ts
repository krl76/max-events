// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for the Place domain entity (venues hosting events).
// SCOPE: Place/CreatePlace schemas, geo and category validation invariants.
// DEPENDS: zod, ./primitives.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - LatitudeSchema - latitude in [-90, 90]
// - Latitude - latitude type
// - LongitudeSchema - longitude in [-180, 180]
// - Longitude - longitude type
// - PlaceCategorySchema - place category enum
// - PlaceCategory - place category type
// - PlaceSchema - full place entity with server-owned published flag
// - Place - full place type
// - CreatePlaceSchema - place creation payload (no id/timestamps, no server-owned published)
// - CreatePlace - place creation payload type
// END_MODULE_MAP

import { z } from "zod";
import { IdSchema, TimestampSchema } from "./primitives.js";

export const LatitudeSchema = z.number().min(-90).max(90);
export type Latitude = z.infer<typeof LatitudeSchema>;

export const LongitudeSchema = z.number().min(-180).max(180);
export type Longitude = z.infer<typeof LongitudeSchema>;

export const PlaceCategorySchema = z.enum(["park", "museum", "food", "sport", "other"]);
export type PlaceCategory = z.infer<typeof PlaceCategorySchema>;

const basePlaceShape = {
  id: IdSchema,
  title: z.string().min(1).max(200),
  address: z.string().min(1).max(300),
  city: z.string().min(1),
  category: PlaceCategorySchema,
  latitude: LatitudeSchema,
  longitude: LongitudeSchema,
};

export const PlaceSchema = z.object({
  ...basePlaceShape,
  published: z.boolean().default(true),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type Place = z.infer<typeof PlaceSchema>;

export const CreatePlaceSchema = PlaceSchema.omit({ id: true, published: true, createdAt: true, updatedAt: true });
export type CreatePlace = z.infer<typeof CreatePlaceSchema>;
