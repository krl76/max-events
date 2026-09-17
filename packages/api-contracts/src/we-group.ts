// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for «Мы» trip groups — members, shared chat, bound events/places, archive.
// SCOPE: group entity, create write, event/place bind writes, screen payload.
// DEPENDS: zod, ./primitives.js, ./event.js, ./place.js, ./friends.js
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
// - WeGroupScreenSchema - group plus members, events, places
// - WeGroupScreen - screen type
// END_MODULE_MAP

import { z } from "zod";
import { EventSchema } from "./event.js";
import { FriendSchema } from "./friends.js";
import { PlaceSchema } from "./place.js";
import { IdSchema, TimestampSchema } from "./primitives.js";

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

export const WeGroupScreenSchema = z.object({
  group: WeGroupSchema,
  members: z.array(FriendSchema),
  events: z.array(EventSchema),
  places: z.array(PlaceSchema),
});
export type WeGroupScreen = z.infer<typeof WeGroupScreenSchema>;
