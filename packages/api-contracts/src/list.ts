// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for personal event/place lists ("Хочу сходить", "Избранное", custom).
// SCOPE: List preset enum, List entity (preset or custom title), List item (event or place + added time), list screen aggregates.
// DEPENDS: zod, ./primitives.js, ./event.js, ./friends.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ListPresetSchema - closed preset enum from README (want_to_go/favorites/weekend/with_children/with_friends/try_later)
// - ListPreset - list preset type
// - ListSchema - list entity (preset link or custom title)
// - List - list type
// - ListItemSchema - list entry referencing an event or a place with the time it was added
// - ListItem - list item type
// - AddListItemWriteSchema - add-event payload
// - CreateListWriteSchema - title of a new list of one's own
// - CreateListWrite - create payload type
// - RenameListWriteSchema - same shape, used to rename
// - RenameListWrite - rename payload type
// - AddListItemWrite - add-event payload type
// - ListSummarySchema - list with counters and optional saved-item id
// - ListSummary - list summary type
// - ListItemCardSchema - list item plus its event
// - ListItemCard - list item card type
// - ListScreenSchema - one list with its event cards
// - ListScreen - list screen type
// END_MODULE_MAP

import { z } from "zod";
import { EventSchema } from "./event.js";
import { FriendSchema } from "./friends.js";
import { IdSchema, TimestampSchema } from "./primitives.js";

export const ListPresetSchema = z.enum(["want_to_go", "favorites", "weekend", "with_children", "with_friends", "try_later"]);
export type ListPreset = z.infer<typeof ListPresetSchema>;

export const ListSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  preset: ListPresetSchema.nullable().default(null),
  title: z.string().min(1).max(200),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type List = z.infer<typeof ListSchema>;

export const ListItemSchema = z
  .object({
    id: IdSchema,
    listId: IdSchema,
    eventId: IdSchema.nullable().default(null),
    placeId: IdSchema.nullable().default(null),
    addedAt: TimestampSchema,
  })
  .refine((data) => (data.eventId !== null) !== (data.placeId !== null), {
    message: "list item must reference exactly one of eventId or placeId",
    path: ["eventId"],
  });
export type ListItem = z.infer<typeof ListItemSchema>;

export const AddListItemWriteSchema = z
  .object({
    eventId: IdSchema.optional(),
    placeId: IdSchema.optional(),
  })
  .refine((data) => (data.eventId !== undefined) !== (data.placeId !== undefined), {
    message: "list item must reference exactly one of eventId or placeId",
    path: ["eventId"],
  });
export type AddListItemWrite = z.infer<typeof AddListItemWriteSchema>;

/** A list of one's own carries a title and no preset; the six presets are created by the backend. */
export const CreateListWriteSchema = z.object({
  title: z.string().trim().min(1).max(200),
});
export type CreateListWrite = z.infer<typeof CreateListWriteSchema>;

export const RenameListWriteSchema = CreateListWriteSchema;
export type RenameListWrite = z.infer<typeof RenameListWriteSchema>;

export const ListSummarySchema = z.object({
  list: ListSchema,
  itemsCount: z.number().int().nonnegative(),
  savedItemId: IdSchema.nullable(),
  participants: z.array(FriendSchema).default([]),
});
export type ListSummary = z.infer<typeof ListSummarySchema>;

export const ListItemCardSchema = z.object({
  item: ListItemSchema,
  event: EventSchema,
  addedBy: FriendSchema.nullable().default(null),
});
export type ListItemCard = z.infer<typeof ListItemCardSchema>;

export const ListScreenSchema = z.object({
  list: ListSchema,
  participants: z.array(FriendSchema).default([]),
  items: z.array(ListItemCardSchema),
});
export type ListScreen = z.infer<typeof ListScreenSchema>;
