// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for shared collections (coauthors, sections, MAX chat share).
// SCOPE: Collection sections, collection entity, member/item write payloads.
// DEPENDS: zod, ./primitives.js, ./event.js, ./friends.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CollectionSectionSchema - want_to_go / already_been / weekend_ideas
// - CollectionSchema - shared collection with optional chatLink
// - CollectionItemSchema - event in a section, attributed to the adder
// - CollectionScreenSchema - collection + members + items
// END_MODULE_MAP

import { z } from "zod";
import { EventSchema } from "./event.js";
import { FriendSchema } from "./friends.js";
import { IdSchema, TimestampSchema } from "./primitives.js";

export const CollectionSectionSchema = z.enum(["want_to_go", "already_been", "weekend_ideas"]);
export type CollectionSection = z.infer<typeof CollectionSectionSchema>;

export const CollectionSchema = z.object({
  id: IdSchema,
  ownerUserId: IdSchema,
  title: z.string().min(1).max(200),
  chatLink: z.string().nullable().default(null),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type Collection = z.infer<typeof CollectionSchema>;

export const CreateCollectionWriteSchema = z.object({
  title: z.string().min(1).max(200),
});
export type CreateCollectionWrite = z.infer<typeof CreateCollectionWriteSchema>;

export const AddCollectionMemberWriteSchema = z.object({
  userId: IdSchema,
});
export type AddCollectionMemberWrite = z.infer<typeof AddCollectionMemberWriteSchema>;

export const AddCollectionItemWriteSchema = z.object({
  eventId: IdSchema,
  section: CollectionSectionSchema,
});
export type AddCollectionItemWrite = z.infer<typeof AddCollectionItemWriteSchema>;

export const CollectionItemSchema = z.object({
  id: IdSchema,
  collectionId: IdSchema,
  eventId: IdSchema,
  section: CollectionSectionSchema,
  addedBy: FriendSchema,
  addedAt: TimestampSchema,
  event: EventSchema,
});
export type CollectionItem = z.infer<typeof CollectionItemSchema>;

export const CollectionScreenSchema = z.object({
  collection: CollectionSchema,
  members: z.array(FriendSchema),
  items: z.array(CollectionItemSchema),
});
export type CollectionScreen = z.infer<typeof CollectionScreenSchema>;
