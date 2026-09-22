// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for reverse discovery — places friends opened that the viewer has not visited.
// SCOPE: summary counts, per-friend new places, friend route of unseen places, and the map layer of places friends actually visited.
// DEPENDS: zod, ./friends.js, ./place.js, ./primitives.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - DiscoveryFriendPlacesSchema - friend plus unseen places
// - DiscoveryFriendPlaces - per-friend type
// - DiscoveryResponseSchema - «Твои люди открыли N мест»
// - DiscoveryResponse - discovery payload
// - FriendRouteSchema - friend's unseen place trail
// - FriendRoute - route type
// - FriendPlaceVisitSchema - one place friends were at: the place, who was there, when the last of them was
// - FriendPlaceVisit - map-layer marker type
// END_MODULE_MAP

import { z } from "zod";
import { FriendSchema } from "./friends.js";
import { PlaceSchema } from "./place.js";

export const DiscoveryFriendPlacesSchema = z.object({
  friend: FriendSchema,
  newPlacesCount: z.number().int().min(0),
  places: z.array(PlaceSchema),
  visitHistoryHidden: z.boolean().default(false),
});
export type DiscoveryFriendPlaces = z.infer<typeof DiscoveryFriendPlacesSchema>;

export const DiscoveryResponseSchema = z.object({
  newPlacesCount: z.number().int().min(0),
  byFriend: z.array(DiscoveryFriendPlacesSchema),
});
export type DiscoveryResponse = z.infer<typeof DiscoveryResponseSchema>;

export const FriendRouteStopSchema = z.object({
  place: PlaceSchema,
  visitedAt: z.string().datetime({ offset: true }).nullable().default(null),
  note: z.string().max(200).nullable().default(null),
});
export type FriendRouteStop = z.infer<typeof FriendRouteStopSchema>;

export const FriendRouteSchema = z.object({
  friend: FriendSchema,
  places: z.array(PlaceSchema),
  stops: z.array(FriendRouteStopSchema).default([]),
});
export type FriendRoute = z.infer<typeof FriendRouteSchema>;

/**
 * The «друзья были здесь» map layer, not a discovery: unlike the schemas above it keeps the places the
 * viewer has visited too, because the layer is about where friends were, not about what is new. Both
 * privacy switches still gate it — a marker tells as much as the place list the summary withholds.
 */
export const FriendPlaceVisitSchema = z.object({
  place: PlaceSchema,
  friends: z.array(FriendSchema).min(1),
  lastVisitAt: z.string().datetime({ offset: true }),
});
export type FriendPlaceVisit = z.infer<typeof FriendPlaceVisitSchema>;
