// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for «Мы» trip groups — members, shared chat, bound events/places, archive.
// SCOPE: group entity, create write, event/place bind writes, screen payload with bookings/route/budget/photos.
// DEPENDS: zod, ./primitives.js, ./event.js, ./place.js, ./friends.js, ./booking.js, ./route.js, ./plan-budget.js, ./review.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - WeGroupStatusSchema - active or archived
// - WeGroupStatus - status type
// - WeGroupSchema - trip group
// - WeGroup - group type
// - CreateWeGroupWriteSchema - title and member ids
// - CreateWeGroupWrite - write type
// - AddWeGroupEventWriteSchema - bind event
// - AddWeGroupEventWrite - event write type
// - AddWeGroupPlaceWriteSchema - bind place
// - AddWeGroupPlaceWrite - place write type
// - WeGroupScreenSchema - group plus members, events, places, bookings, route, budget, photos
// - WeGroupScreen - screen type
// - WeGroupEventGoingSchema - which members are going to one bound event
// - WeGroupEventGoing - going type
// - WeGroupSummarySchema - GET /we-groups row: group plus member, upcoming-event and photo counts, budget total, next event title
// - WeGroupSummary - summary type
// END_MODULE_MAP

import { z } from "zod";
import { BookingSchema } from "./booking.js";
import { EventSchema } from "./event.js";
import { FriendSchema } from "./friends.js";
import { PlanBudgetSchema } from "./plan-budget.js";
import { PlaceSchema } from "./place.js";
import { IdSchema, TimestampSchema } from "./primitives.js";
import { ReviewPhotoSchema } from "./review.js";
import { DayRouteSchema } from "./route.js";

export const WeGroupStatusSchema = z.enum(["active", "archived"]);
export type WeGroupStatus = z.infer<typeof WeGroupStatusSchema>;

export const WeGroupSchema = z.object({
  id: IdSchema,
  ownerUserId: IdSchema,
  title: z.string().min(1).max(200),
  chatLink: z.string().nullable().default(null),
  status: WeGroupStatusSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  archivedAt: TimestampSchema.nullable(),
});
export type WeGroup = z.infer<typeof WeGroupSchema>;

export const CreateWeGroupWriteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  memberIds: z.array(IdSchema).default([]),
});
export type CreateWeGroupWrite = z.infer<typeof CreateWeGroupWriteSchema>;

export const AddWeGroupEventWriteSchema = z.object({
  eventId: IdSchema,
});
export type AddWeGroupEventWrite = z.infer<typeof AddWeGroupEventWriteSchema>;

export const AddWeGroupPlaceWriteSchema = z.object({
  placeId: IdSchema,
});
export type AddWeGroupPlaceWrite = z.infer<typeof AddWeGroupPlaceWriteSchema>;

export const AddWeGroupPhotoWriteSchema = z.object({
  url: z.string().url().max(16_000).regex(/^(data:image\/|https:\/\/)/, "photo must be an image data URL or an https URL"),
});
export type AddWeGroupPhotoWrite = z.infer<typeof AddWeGroupPhotoWriteSchema>;

export const WeGroupEventGoingSchema = z.object({
  eventId: IdSchema,
  going: z.array(FriendSchema),
});
export type WeGroupEventGoing = z.infer<typeof WeGroupEventGoingSchema>;

export const WeGroupScreenSchema = z.object({
  group: WeGroupSchema,
  members: z.array(FriendSchema),
  events: z.array(EventSchema),
  places: z.array(PlaceSchema),
  bookings: z.array(BookingSchema).default([]),
  route: DayRouteSchema.nullable().default(null),
  budget: PlanBudgetSchema.nullable().default(null),
  photos: z.array(ReviewPhotoSchema).default([]),
  photosTotal: z.number().int().nonnegative().default(0),
  goingByEvent: z.array(WeGroupEventGoingSchema).default([]),
});
export type WeGroupScreen = z.infer<typeof WeGroupScreenSchema>;

export const WeGroupSummarySchema = z.object({
  group: WeGroupSchema,
  membersCount: z.number().int().nonnegative(),
  upcomingEventsCount: z.number().int().nonnegative(),
  photosTotal: z.number().int().nonnegative(),
  budgetTotalRub: z.number().nonnegative().nullable().default(null),
  nextEventTitle: z.string().nullable().default(null),
});
export type WeGroupSummary = z.infer<typeof WeGroupSummarySchema>;
