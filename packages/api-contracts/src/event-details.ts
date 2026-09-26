// START_MODULE_CONTRACT
// PURPOSE: Zod contract for the event page aggregate (GET /events/:id/details) and companions (GET /events/:id/companions).
// SCOPE: EventDetails — event, place, organizer user, the organization behind that organizer, remaining seats, viewer-scoped active booking / check-in / participation, rating summary. EventCompanions — экран 23 counters, people and gathering teaser.
// DEPENDS: zod, ./primitives.js, ./event.js, ./place.js, ./user.js, ./organization.js, ./participation.js, ./review.js, ./friends.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - EventDetailsSchema - aggregated event details payload
// - EventDetails - event details type
// - EventCompanionSchema - one person going to the event, as the companions screen shows them
// - EventCompanion - companion type
// - EventGatheringTeaserSchema - the open gathering an event carries, teased on the companions screen
// - EventGatheringTeaser - gathering teaser type
// - EventCompanionsSchema - экран 23 aggregate (#538)
// - EventCompanions - companions type
// - EventBookingOfferSchema - экран 18 waitlist-ahead + friends with tickets (#539)
// - EventBookingOffer - booking-offer type
// END_MODULE_MAP

import { z } from "zod";
import { EventSchema } from "./event.js";
import { FriendSchema } from "./friends.js";
import { OrganizationSchema } from "./organization.js";
import { ParticipationStatusSchema } from "./participation.js";
import { PlaceSchema } from "./place.js";
import { IdSchema } from "./primitives.js";
import { EventRatingSchema } from "./review.js";
import { UserSchema } from "./user.js";

export const EventDetailsSchema = z.object({
  event: EventSchema,
  place: PlaceSchema.nullable(),
  organizer: UserSchema.nullable(),
  /** The organizer's organization, when the organizer user belongs to one. Public: name and contacts only. */
  organization: OrganizationSchema.nullable(),
  remainingSeats: z.number().int().nonnegative().nullable(),
  activeBookingId: IdSchema.nullable(),
  checkInId: IdSchema.nullable(),
  myParticipationStatus: ParticipationStatusSchema.nullable(),
  rating: EventRatingSchema,
});
export type EventDetails = z.infer<typeof EventDetailsSchema>;

export const EventCompanionSchema = z.object({
  friend: FriendSchema,
  status: ParticipationStatusSchema,
  chatTitle: z.string().nullable(),
  sharedPlansCount: z.number().int().min(0),
  matchesCount: z.number().int().min(0),
  interests: z.array(z.string()),
  note: z.string().nullable(),
});
export type EventCompanion = z.infer<typeof EventCompanionSchema>;

export const EventGatheringTeaserSchema = z.object({
  members: z.array(FriendSchema),
  extraCount: z.number().int().min(0),
  meetingNote: z.string().min(1),
});
export type EventGatheringTeaser = z.infer<typeof EventGatheringTeaserSchema>;

export const EventCompanionsSchema = z.object({
  counts: z.object({
    going: z.number().int().min(0),
    wants: z.number().int().min(0),
    looking: z.number().int().min(0),
  }),
  myStatus: ParticipationStatusSchema.nullable(),
  companions: z.array(EventCompanionSchema),
  gathering: EventGatheringTeaserSchema.nullable(),
});
export type EventCompanions = z.infer<typeof EventCompanionsSchema>;

/** Экран 18: how many wait in front of the viewer, and which friends already hold a ticket. */
export const EventBookingOfferSchema = z.object({
  waitlistAhead: z.number().int().min(0),
  friendsWithTickets: z.array(FriendSchema),
});
export type EventBookingOffer = z.infer<typeof EventBookingOfferSchema>;
