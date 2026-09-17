// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for reverse discovery — places friends opened that the viewer has not visited.
// SCOPE: summary counts, per-friend new places, friend route of unseen places.
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
// END_MODULE_MAP

import { z } from "zod";
import { FriendSchema } from "./friends.js";
import { PlaceSchema } from "./place.js";

export const DiscoveryFriendPlacesSchema = z.object({
  friend: FriendSchema,
  newPlacesCount: z.number().int().min(0),
  places: z.array(PlaceSchema),
});
export type DiscoveryFriendPlaces = z.infer<typeof DiscoveryFriendPlacesSchema>;

export const DiscoveryResponseSchema = z.object({
  newPlacesCount: z.number().int().min(0),
  byFriend: z.array(DiscoveryFriendPlacesSchema),
});
export type DiscoveryResponse = z.infer<typeof DiscoveryResponseSchema>;

export const FriendRouteSchema = z.object({
  friend: FriendSchema,
  places: z.array(PlaceSchema),
});
export type FriendRoute = z.infer<typeof FriendRouteSchema>;
