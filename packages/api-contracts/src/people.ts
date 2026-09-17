// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for people matching through events — shared interests/geo, no dating mechanics.
// SCOPE: match context, candidate, response with looking-for-company-today count.
// DEPENDS: zod, ./friends.js, ./event.js, ./primitives.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PeopleMatchContextSchema - shared event or interest
// - PeopleMatchContext - context type
// - PeopleCandidateSchema - nearby person with overlap
// - PeopleCandidate - candidate type
// - PeopleResponseSchema - list plus looking-for-company-today count
// - PeopleResponse - response type
// END_MODULE_MAP

import { z } from "zod";
import { EventSchema } from "./event.js";
import { FriendSchema } from "./friends.js";

export const PeopleMatchContextSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("shared_event"), event: EventSchema, explanation: z.string().min(1) }),
  z.object({ kind: z.literal("shared_interest"), interest: z.string().min(1), explanation: z.string().min(1) }),
]);
export type PeopleMatchContext = z.infer<typeof PeopleMatchContextSchema>;

export const PeopleCandidateSchema = z.object({
  person: FriendSchema,
  distanceKm: z.number().nonnegative().nullable(),
  sharedInterests: z.array(z.string().min(1)),
  lookingForCompanyToday: z.boolean(),
  context: PeopleMatchContextSchema,
});
export type PeopleCandidate = z.infer<typeof PeopleCandidateSchema>;

export const PeopleResponseSchema = z.object({
  nearbyCount: z.number().int().min(0),
  lookingForCompanyTodayCount: z.number().int().min(0),
  people: z.array(PeopleCandidateSchema),
});
export type PeopleResponse = z.infer<typeof PeopleResponseSchema>;
