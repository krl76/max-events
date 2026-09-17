// START_MODULE_CONTRACT
// PURPOSE: Zod contract for the place-as-social-object page aggregate.
// SCOPE: PlacePage — today events, friend visits, ratings, popularity, personal history.
// DEPENDS: zod, ./primitives.js, ./event.js, ./review.js, ./friends.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PlaceFriendVisitSchema - friend who visited or is going today
// - PlaceFriendVisit - friend visit type
// - PlacePageSchema - aggregated place page
// - PlacePage - place page type
// END_MODULE_MAP

import { z } from "zod";
import { EventSchema } from "./event.js";
import { FriendSchema } from "./friends.js";
import { IdSchema } from "./primitives.js";
import { EventRatingSchema } from "./review.js";

export const PlaceFriendVisitSchema = z.object({
  friend: FriendSchema,
  visitsCount: z.number().int().min(0),
  goingToday: z.boolean(),
});
export type PlaceFriendVisit = z.infer<typeof PlaceFriendVisitSchema>;

export const PlacePageSchema = z.object({
  placeId: IdSchema,
  todayEvents: z.array(EventSchema),
  friends: z.array(PlaceFriendVisitSchema),
  rating: EventRatingSchema.nullable(),
  popularityToday: z.number().int().min(0),
  personalVisitsCount: z.number().int().min(0),
});
export type PlacePage = z.infer<typeof PlacePageSchema>;
