// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for the "What to do today?" personal digest (summary + contextual cards).
// SCOPE: Today summary counters, typed card labels (discriminated union), event cards.
// DEPENDS: zod, ./event.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - TodaySummarySchema - digest counters (nearby / suitable / with friends)
// - TodaySummary - summary type
// - TodayCardLabelSchema - typed label union (distance/friend/free entry/spots left)
// - TodayCardLabel - card label type
// - TodayEventCardSchema - event card with contextual typed labels
// - TodayEventCard - event card type
// - TodayResponseSchema - digest response (summary + cards)
// - TodayResponse - digest response type
// END_MODULE_MAP

import { z } from "zod";
import { EventSchema } from "./event.js";

export const TodaySummarySchema = z.object({
  nearbyCount: z.number().int().min(0),
  suitableCount: z.number().int().min(0),
  withFriendsCount: z.number().int().min(0),
});
export type TodaySummary = z.infer<typeof TodaySummarySchema>;

export const TodayCardLabelSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("distance"),
    minutes: z.number().int().min(0),
  }),
  z.object({
    kind: z.literal("friend_attending"),
    friendName: z.string().min(1).max(200),
  }),
  z.object({
    kind: z.literal("free_entry"),
  }),
  z.object({
    kind: z.literal("spots_left"),
    count: z.number().int().min(0),
  }),
]);
export type TodayCardLabel = z.infer<typeof TodayCardLabelSchema>;

export const TodayEventCardSchema = z.object({
  event: EventSchema,
  labels: z.array(TodayCardLabelSchema),
});
export type TodayEventCard = z.infer<typeof TodayEventCardSchema>;

export const TodayResponseSchema = z.object({
  summary: TodaySummarySchema,
  cards: z.array(TodayEventCardSchema),
});
export type TodayResponse = z.infer<typeof TodayResponseSchema>;
