// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for the Event domain entity, shared by frontend and backend.
// SCOPE: Event/CreateEvent schemas and inferred types; validation invariants (price, dates, capacity).
// DEPENDS: zod
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - EventCategorySchema - event category enum
// - EventCategory - event category type
// - EventSchema - full event schema with defaults
// - Event - full event type
// - CreateEventSchema - event creation payload (no id)
// - CreateEvent - event creation payload type
// END_MODULE_MAP

import { z } from "zod";

export const EventCategorySchema = z.enum(["afisha", "volunteering", "tourism", "sport"]);
export type EventCategory = z.infer<typeof EventCategorySchema>;

export const EventSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).default(""),
  category: EventCategorySchema,
  city: z.string().min(1),
  placeId: z.string().uuid().nullable().default(null),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }).nullable().default(null),
  isPaid: z.boolean().default(false),
  priceRub: z.number().int().nonnegative().nullable().default(null),
  paymentUrl: z.string().url().nullable().default(null),
  capacity: z.number().int().positive().nullable().default(null),
});
export type Event = z.infer<typeof EventSchema>;

export const CreateEventSchema = EventSchema.omit({ id: true });
export type CreateEvent = z.infer<typeof CreateEventSchema>;
