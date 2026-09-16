// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for friends and the "Your people are going" feed.
// SCOPE: Friend entity, friend activity feed grouped by friend and by event.
// DEPENDS: zod, ./primitives.js, ./event.js, ./participation.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - FriendSchema - friend entity (id, name, nullable avatar)
// - Friend - friend type
// - FriendEventSchema - friend-to-event entry (event + participation status)
// - FriendEvent - friend-to-event entry type
// - EventFriendSchema - event-to-friend entry (friend + participation status)
// - EventFriend - event-to-friend entry type
// - Friend - friend type
// - FriendActivitySchema - one feed entry: friend going to an event with participation status
// - FriendActivity - feed entry type
// - FriendActivityByFriendSchema - feed grouped by friend (friend with their events)
// - FriendActivityByFriend - grouped-by-friend type
// - FriendActivityByEventSchema - feed grouped by event (event with attending friends)
// - FriendActivityByEvent - grouped-by-event type
// - EventFriendsSummarySchema - friends on one event plus going / looking_for_company counts
// - EventFriendsSummary - friends-on-event summary type
// END_MODULE_MAP

import { z } from "zod";
import { IdSchema } from "./primitives.js";
import { EventSchema } from "./event.js";
import { ParticipationStatusSchema } from "./participation.js";

export const FriendSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(200),
  avatarUrl: z.string().url().nullable().default(null),
});
export type Friend = z.infer<typeof FriendSchema>;

export const FriendEventSchema = z.object({
  event: EventSchema,
  participationStatus: ParticipationStatusSchema,
});
export type FriendEvent = z.infer<typeof FriendEventSchema>;

export const EventFriendSchema = z.object({
  friend: FriendSchema,
  participationStatus: ParticipationStatusSchema,
});
export type EventFriend = z.infer<typeof EventFriendSchema>;

export const FriendActivitySchema = z.object({
  friend: FriendSchema,
  event: EventSchema,
  participationStatus: ParticipationStatusSchema,
});
export type FriendActivity = z.infer<typeof FriendActivitySchema>;

export const FriendActivityByFriendSchema = z.object({
  friend: FriendSchema,
  events: z.array(FriendEventSchema),
});
export type FriendActivityByFriend = z.infer<typeof FriendActivityByFriendSchema>;

export const FriendActivityByEventSchema = z.object({
  event: EventSchema,
  friends: z.array(EventFriendSchema),
});
export type FriendActivityByEvent = z.infer<typeof FriendActivityByEventSchema>;

export const EventFriendsSummarySchema = z.object({
  friends: z.array(EventFriendSchema),
  going: z.number().int().nonnegative(),
  lookingForCompany: z.number().int().nonnegative(),
});
export type EventFriendsSummary = z.infer<typeof EventFriendsSummarySchema>;
