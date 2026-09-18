// START_MODULE_CONTRACT
// PURPOSE: Zod contract for the event page aggregate (GET /events/:id/details).
// SCOPE: EventDetails — event, place, organizer, remaining seats, viewer-scoped active booking / check-in / participation, rating summary.
// DEPENDS: zod, ./primitives.js, ./event.js, ./place.js, ./user.js, ./participation.js, ./review.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - EventDetailsSchema - aggregated event details payload
// - EventDetails - event details type
// END_MODULE_MAP

import { z } from "zod";
import { EventSchema } from "./event.js";
import { ParticipationStatusSchema } from "./participation.js";
import { PlaceSchema } from "./place.js";
import { IdSchema } from "./primitives.js";
import { EventRatingSchema } from "./review.js";
import { UserSchema } from "./user.js";

export const EventDetailsSchema = z.object({
  event: EventSchema,
  place: PlaceSchema.nullable(),
  organizer: UserSchema.nullable(),
  remainingSeats: z.number().int().nonnegative().nullable(),
  activeBookingId: IdSchema.nullable(),
  checkInId: IdSchema.nullable(),
  myParticipationStatus: ParticipationStatusSchema.nullable(),
  rating: EventRatingSchema,
});
export type EventDetails = z.infer<typeof EventDetailsSchema>;
