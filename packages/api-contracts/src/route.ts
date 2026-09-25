// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for a day route timeline and its distance/time optimization.
// SCOPE: Route stop write (event or place), route timeline with travel legs, optimize delta.
// DEPENDS: zod, ./primitives.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - RouteStopWriteSchema - eventId xor placeId
// - RouteStopWrite - stop write type
// - CreateDayRouteWriteSchema - build/optimize payload
// - CreateDayRouteWrite - payload type
// - RoutePointSchema - resolved stop with coordinates
// - RoutePoint - point type
// - RouteLegSchema - travel between two points
// - RouteLeg - leg type
// - DayRouteSchema - ordered stops plus travel legs
// - DayRoute - day route type
// - OptimizeRouteSchema - original vs optimized with savings
// - OptimizeRoute - optimize result type
// END_MODULE_MAP

import { z } from "zod";
import { IdSchema } from "./primitives.js";

export const RouteStopWriteSchema = z
  .object({
    eventId: IdSchema.nullable().optional(),
    placeId: IdSchema.nullable().optional(),
  })
  .refine((data) => (data.eventId != null) !== (data.placeId != null), {
    message: "route stop must reference exactly one of eventId or placeId",
    path: ["eventId"],
  });
export type RouteStopWrite = z.infer<typeof RouteStopWriteSchema>;

export const RoutePreferSchema = z.enum(["default", "cheaper", "no_taxi"]);
export type RoutePrefer = z.infer<typeof RoutePreferSchema>;

export const RouteModeSchema = z.enum(["walk", "metro", "taxi"]);
export type RouteMode = z.infer<typeof RouteModeSchema>;

export const CreateDayRouteWriteSchema = z.object({
  stops: z.array(RouteStopWriteSchema).min(2).max(8),
  latitude: z.number().gte(-90).lte(90).optional(),
  longitude: z.number().gte(-180).lte(180).optional(),
  prefer: RoutePreferSchema.optional(),
});
export type CreateDayRouteWrite = z.infer<typeof CreateDayRouteWriteSchema>;

export const RoutePointSchema = z.object({
  title: z.string().min(1),
  at: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  eventId: IdSchema.nullable().default(null),
  placeId: IdSchema.nullable().default(null),
});
export type RoutePoint = z.infer<typeof RoutePointSchema>;

export const RouteLegSchema = z.object({
  fromTitle: z.string().min(1),
  toTitle: z.string().min(1),
  travelMinutes: z.number().int().min(0),
  distanceKm: z.number().nonnegative(),
  mode: RouteModeSchema.default("walk"),
  transfers: z.number().int().min(0).default(0),
  priceRub: z.number().int().min(0).nullable().default(null),
});
export type RouteLeg = z.infer<typeof RouteLegSchema>;

export const DayRouteSchema = z.object({
  points: z.array(RoutePointSchema).min(2),
  legs: z.array(RouteLegSchema),
  totalMinutes: z.number().int().min(0),
  totalKm: z.number().nonnegative(),
});
export type DayRoute = z.infer<typeof DayRouteSchema>;

export const OptimizeRouteSchema = z.object({
  original: DayRouteSchema,
  optimized: DayRouteSchema,
  savedMinutes: z.number().int(),
  savedKm: z.number(),
});
export type OptimizeRoute = z.infer<typeof OptimizeRouteSchema>;
