// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for a shared event vote ("Куда идем в пятницу?").
// SCOPE: vote entity, create write, ballot write, option tallies and winner.
// DEPENDS: zod, ./primitives.js, ./event.js, ./friends.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - VoteOptionTallySchema - event plus vote count
// - VoteOptionTally - option tally type
// - VoteSchema - vote with options, participants, winner, viewer's own ballot
// - Vote - vote type
// - CreateVoteWriteSchema - title, event ids, participant ids
// - CreateVoteWrite - create write type
// - VoteBallotWriteSchema - chosen event id
// - VoteBallotWrite - ballot write type
// - VoteStatusSchema - open while ballots are taken, closed once the host finished the vote
// - VoteStatus - vote status type
// END_MODULE_MAP

import { z } from "zod";
import { EventSchema } from "./event.js";
import { FriendSchema } from "./friends.js";
import { IdSchema, TimestampSchema } from "./primitives.js";

const uniqueIds = (ids: string[]) => new Set(ids).size === ids.length;

export const VoteOptionTallySchema = z.object({
  event: EventSchema,
  votes: z.number().int().nonnegative(),
});
export type VoteOptionTally = z.infer<typeof VoteOptionTallySchema>;

export const VoteStatusSchema = z.enum(["open", "closed"]);
export type VoteStatus = z.infer<typeof VoteStatusSchema>;

export const VoteSchema = z.object({
  id: IdSchema,
  hostUserId: IdSchema,
  title: z.string().min(1).max(200),
  chatLink: z.string().nullable().default(null),
  status: VoteStatusSchema.default("open"),
  participants: z.array(FriendSchema),
  options: z.array(VoteOptionTallySchema),
  winnerEventId: IdSchema.nullable(),
  myBallotEventId: IdSchema.nullable().default(null),
  votedUserIds: z.array(IdSchema).default([]),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type Vote = z.infer<typeof VoteSchema>;

export const CreateVoteWriteSchema = z.object({
  title: z.string().trim().min(1).max(200).default("Куда идем в пятницу?"),
  eventIds: z.array(IdSchema).min(2).max(10).refine(uniqueIds, { message: "duplicate event ids" }),
  participantIds: z.array(IdSchema).min(1).refine(uniqueIds, { message: "duplicate participant ids" }),
});
export type CreateVoteWrite = z.infer<typeof CreateVoteWriteSchema>;

export const VoteBallotWriteSchema = z.object({
  eventId: IdSchema,
});
export type VoteBallotWrite = z.infer<typeof VoteBallotWriteSchema>;
