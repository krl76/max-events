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
// - EventSchema - full event schema with defaults and paid/free payment link invariant
// - Event - full event type
// - CreateEventSchema - event creation payload (no id, no server-owned chatLink)
// - CreateEvent - event creation payload type
// END_MODULE_MAP

import { z } from "zod";
import { IdSchema, TimestampSchema } from "./primitives.js";

export const EventCategorySchema = z.enum(["afisha", "volunteering", "tourism", "sport"]);
export type EventCategory = z.infer<typeof EventCategorySchema>;

const EventObjectSchema = z.object({
  id: IdSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(5000).default(""),
  category: EventCategorySchema,
  city: z.string().min(1),
  placeId: IdSchema.nullable().default(null),
  startsAt: TimestampSchema,
  endsAt: TimestampSchema.nullable().default(null),
  isPaid: z.boolean().default(false),
  priceRub: z.number().int().nonnegative().nullable().default(null),
  paymentUrl: z.string().url().nullable().default(null),
  capacity: z.number().int().positive().nullable().default(null),
  chatLink: z.string().nullable().default(null),
});

const hasValidPaymentLink = (data: { isPaid: boolean; paymentUrl: string | null }) => (data.isPaid ? data.paymentUrl !== null : data.paymentUrl === null);

const paymentLinkInvariant = {
  message: "paid events require paymentUrl, free events must not have one",
  path: ["paymentUrl"],
};

export const EventSchema = EventObjectSchema.refine(hasValidPaymentLink, paymentLinkInvariant);
export type Event = z.infer<typeof EventSchema>;

export const CreateEventSchema = EventObjectSchema.omit({ id: true, chatLink: true }).refine(hasValidPaymentLink, paymentLinkInvariant);
export type CreateEvent = z.infer<typeof CreateEventSchema>;
