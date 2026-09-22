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
// - FeedPostSchema - impression post with like counter and comments
// - FeedPost - feed post type
// - CreateFeedPostWriteSchema - create-post payload
// - CreateFeedPostWrite - create-post type
// - AddFeedCommentWriteSchema - add-comment payload
// - AddFeedCommentWrite - add-comment type
// END_MODULE_MAP

import { z } from "zod";
import { FriendSchema } from "./friends.js";
import { IdSchema } from "./primitives.js";

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
const photoUrlSchema = z.string().url().max(MAX_FEED_PHOTO_URL_LENGTH).regex(PHOTO_URL_PATTERN, "photo must be an image data URL or an https URL");

export const FeedCommentSchema = z.object({
  id: IdSchema,
  author: FriendSchema,
  text: z.string().min(1).max(2000),
});
export type FeedComment = z.infer<typeof FeedCommentSchema>;

export const FeedPostSchema = z.object({
  id: IdSchema,
  author: FriendSchema,
  eventId: IdSchema,
  text: z.string().min(1).max(5000),
  photoUrl: photoUrlSchema.nullable().default(null),
  likesCount: z.number().int().min(0),
  likedByMe: z.boolean(),
  comments: z.array(FeedCommentSchema).default([]),
});
export type FeedPost = z.infer<typeof FeedPostSchema>;

export const CreateFeedPostWriteSchema = z.object({
  eventId: IdSchema,
  text: z.string().min(1).max(5000),
  photoUrl: photoUrlSchema.nullable().optional(),
});
export type CreateFeedPostWrite = z.infer<typeof CreateFeedPostWriteSchema>;

export const AddFeedCommentWriteSchema = z.object({
  text: z.string().min(1).max(2000),
});
export type AddFeedCommentWrite = z.infer<typeof AddFeedCommentWriteSchema>;
