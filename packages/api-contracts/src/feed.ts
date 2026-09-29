// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for the feed wall — impression posts, likes and comments.
// SCOPE: FeedPost/FeedComment entities with an optional post photo (MAX_FEED_PHOTO_URL_LENGTH caps what one post may carry), create-post and add-comment write payloads.
// DEPENDS: zod, ./primitives.js, ./friends.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MAX_FEED_PHOTO_URL_LENGTH - longest photo reference a post may carry
// - FeedCommentSchema - comment on a feed post
// - FeedComment - comment type
// - PostAudienceSchema - who a post is for: friends, the city or a company
// - PostAudience - post audience type
// - FeedPostSchema - impression post with like counter and comments
// - FeedPost - feed post type
// - CreateFeedPostWriteSchema - create-post payload
// - CreateFeedPostWrite - create-post type
// - AddFeedCommentWriteSchema - add-comment payload
// - AddFeedCommentWrite - add-comment type
// - FeedDraftWriteSchema - composer autosave (#542)
// - FeedDraftWrite - composer autosave type
// - FeedDraftSavedSchema - { savedAt } receipt
// - FeedDraftSaved - autosave receipt type
// - FeedCardCountsSchema - wants/going/waitlist/freeSeats, null only when unknown
// - FeedCardCounts - card counters type
// - FeedFriendCardSchema - home feed card about what a friend is going to (#541)
// - FeedPlaceCardSchema - home feed card published by a venue (#541)
// - FeedFriendCard - friend card type
// - FeedPlaceCard - venue card type
// - FeedCardSchema - discriminated union
// - FeedCard - home feed card type
// END_MODULE_MAP

import { z } from "zod";
import { EventSchema } from "./event.js";
import { FriendSchema } from "./friends.js";
import { ParticipationStatusSchema } from "./participation.js";
import { PlaceSchema } from "./place.js";
import { IdSchema, TimestampSchema } from "./primitives.js";

/**
 * A picked photo travels inline as a data URL until object storage lands (#477), so this is a payload
 * budget rather than a URL length. It is deliberately small: the feed answers up to 50 posts at once
 * and a data URL cannot be cached by the browser, so every extra kilobyte here is paid again on every
 * open of the feed. ~12 KB per photo keeps a full page under a megabyte. A real https URL, once there
 * is somewhere to upload to, fits in a fraction of it.
 */
export const MAX_FEED_PHOTO_URL_LENGTH = 16_000;

/**
 * Stored photos are either something we produced (a JPEG data URL) or something uploaded to storage.
 * Without this any authenticated user could persist `https://attacker/beacon.gif` — served to every
 * reader of the feed — or a `javascript:`/`data:text/html` value waiting for the first careless sink.
 */
const PHOTO_URL_PATTERN = /^(data:image\/|https:\/\/)/;
const LOCAL_PHOTO_PATTERN = /^\/(?:covers|onboarding|api\/(?:media|uploads))\//;
const photoUrlSchema = z.union([z.string().url().max(MAX_FEED_PHOTO_URL_LENGTH).regex(PHOTO_URL_PATTERN, "photo must be an image data URL or an https URL"), z.string().max(300).regex(LOCAL_PHOTO_PATTERN, "photo must be a same-origin cover")]);

export const FeedCommentSchema = z.object({
  id: IdSchema,
  author: FriendSchema,
  text: z.string().min(1).max(2000),
  /** The root comment this one answers. Null on a top-level comment. A reply to a reply points at that root. */
  parentId: IdSchema.nullable().optional(),
});
export type FeedComment = z.infer<typeof FeedCommentSchema>;

export const PostAudienceSchema = z.enum(["friends", "city", "company"]);
export type PostAudience = z.infer<typeof PostAudienceSchema>;

export const FeedRepostSchema = z.object({
  postId: IdSchema,
  author: FriendSchema,
  text: z.string(),
  photoUrl: photoUrlSchema.nullable(),
});
export type FeedRepost = z.infer<typeof FeedRepostSchema>;

export const FeedPostSchema = z.object({
  id: IdSchema,
  author: FriendSchema,
  eventId: IdSchema.nullable(),
  /** Empty when the post is a repost: the original caption lives on repostOf, still attributed to its author. */
  text: z.string().max(5000),
  photoUrl: photoUrlSchema.nullable().default(null),
  photoUrls: z.array(photoUrlSchema).max(3).optional(),
  placeId: IdSchema.nullable().default(null),
  locationLabel: z.string().min(1).max(120).nullable().optional(),
  taggedFriendIds: z.array(IdSchema).default([]),
  audience: PostAudienceSchema.default("friends"),
  allowJoin: z.boolean().default(false),
  likesCount: z.number().int().min(0),
  likedByMe: z.boolean(),
  /** Friends who liked the post. The viewer is not in this list. Older responses omit it. */
  likedByFriends: z.array(FriendSchema).optional(),
  comments: z.array(FeedCommentSchema).default([]),
  /** The original post, when this one is a repost. Absent on a post the author wrote themselves. */
  repostOf: FeedRepostSchema.nullable().optional(),
});
export type FeedPost = z.infer<typeof FeedPostSchema>;

export const CreateFeedPostWriteSchema = z.object({
  eventId: IdSchema.nullable().optional(),
  text: z.string().min(1).max(5000),
  photoUrl: photoUrlSchema.nullable().optional(),
  photoUrls: z.array(photoUrlSchema).max(3).optional(),
  placeId: IdSchema.nullable().optional(),
  locationLabel: z.string().min(1).max(120).nullable().optional(),
  taggedFriendIds: z.array(IdSchema).optional(),
  audience: PostAudienceSchema.optional(),
  allowJoin: z.boolean().optional(),
});
export type CreateFeedPostWrite = z.infer<typeof CreateFeedPostWriteSchema>;

export const AddFeedCommentWriteSchema = z.object({
  text: z.string().min(1).max(2000),
  parentId: IdSchema.nullable().optional(),
});
export type AddFeedCommentWrite = z.infer<typeof AddFeedCommentWriteSchema>;

export const FeedDraftWriteSchema = z.object({
  eventId: IdSchema.nullable(),
  text: z.string().max(5000).default(""),
  photoUrls: z.array(photoUrlSchema).max(10).optional(),
  placeId: IdSchema.nullable().optional(),
  taggedFriendIds: z.array(IdSchema).optional(),
  audience: PostAudienceSchema.optional(),
  allowJoin: z.boolean().optional(),
});
export type FeedDraftWrite = z.infer<typeof FeedDraftWriteSchema>;

export const FeedDraftSavedSchema = z.object({
  savedAt: TimestampSchema,
});
export type FeedDraftSaved = z.infer<typeof FeedDraftSavedSchema>;

export const FeedCardCountsSchema = z.object({
  wantsToGo: z.number().int().min(0).nullable(),
  going: z.number().int().min(0).nullable(),
  waitlist: z.number().int().min(0).nullable(),
  freeSeats: z.number().int().min(0).nullable(),
});
export type FeedCardCounts = z.infer<typeof FeedCardCountsSchema>;

export const FeedFriendCardSchema = z.object({
  kind: z.literal("friend"),
  id: IdSchema,
  author: FriendSchema,
  placeTitle: z.string().nullable(),
  /** Coordinates the author dropped, stored as "lat, lng". Absent on older cards. */
  locationLabel: z.string().min(1).max(120).nullable().optional(),
  distanceKm: z.number().nonnegative().nullable(),
  event: EventSchema.nullable(),
  photoUrls: z.array(photoUrlSchema).max(3).optional(),
  live: z.boolean(),
  hit: z.boolean(),
  counts: FeedCardCountsSchema,
  myStatus: ParticipationStatusSchema.nullable(),
  text: z.string(),
  likesCount: z.number().int().min(0),
  likedByMe: z.boolean(),
  /** Friends who liked the post. The viewer is not in this list. */
  likedByFriends: z.array(FriendSchema).default([]),
  comments: z.array(FeedCommentSchema),
  commentsCount: z.number().int().min(0),
  publishedAt: TimestampSchema.nullable(),
  photoUrl: photoUrlSchema.nullable().default(null),
  /** Friends of the author who marked «Я иду» on this post, including the viewer. Null when the viewer is not a friend of the author. */
  friendsGoing: z.number().int().min(0).nullable().optional(),
  /** This viewer's mark on this post, not on the event. */
  goingByMe: z.boolean().optional(),
  repostOf: FeedRepostSchema.nullable().optional(),
});
export type FeedFriendCard = z.infer<typeof FeedFriendCardSchema>;

export const FeedPlaceCardSchema = z.object({
  kind: z.literal("place"),
  id: IdSchema,
  place: PlaceSchema,
  verified: z.boolean(),
  distanceKm: z.number().nonnegative().nullable(),
  travelMinutes: z.number().int().min(0).nullable(),
  rating: z.number().min(0).max(5).nullable(),
  pricePerHourRub: z.number().int().min(0).nullable(),
  slotLabel: z.string().nullable(),
  offerLabel: z.string().nullable(),
  goingFriends: z.array(FriendSchema),
  title: z.string(),
  text: z.string(),
  quote: z.object({ author: FriendSchema, text: z.string() }).nullable(),
  likesCount: z.number().int().min(0),
  likedByMe: z.boolean(),
  commentsCount: z.number().int().min(0),
  myStatus: ParticipationStatusSchema.nullable(),
  publishedAt: TimestampSchema,
});
export type FeedPlaceCard = z.infer<typeof FeedPlaceCardSchema>;

export const FeedCardSchema = z.discriminatedUnion("kind", [FeedFriendCardSchema, FeedPlaceCardSchema]);
export type FeedCard = z.infer<typeof FeedCardSchema>;
