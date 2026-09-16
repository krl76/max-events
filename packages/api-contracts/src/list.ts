// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for personal event/place lists ("Хочу сходить", "Избранное", custom).
// SCOPE: List preset enum, List entity (preset or custom title), List item (event or place + added time).
// DEPENDS: zod, ./primitives.js
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
// END_MODULE_MAP

import { z } from "zod";
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
