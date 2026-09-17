// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for the feed wall — impression posts, likes and comments.
// SCOPE: FeedPost/FeedComment entities, create-post and add-comment write payloads.
// DEPENDS: zod, ./primitives.js, ./friends.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
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
  likesCount: z.number().int().min(0),
  likedByMe: z.boolean(),
  comments: z.array(FeedCommentSchema).default([]),
});
export type FeedPost = z.infer<typeof FeedPostSchema>;

export const CreateFeedPostWriteSchema = z.object({
  eventId: IdSchema,
  text: z.string().min(1).max(5000),
});
export type CreateFeedPostWrite = z.infer<typeof CreateFeedPostWriteSchema>;

export const AddFeedCommentWriteSchema = z.object({
  text: z.string().min(1).max(2000),
});
export type AddFeedCommentWrite = z.infer<typeof AddFeedCommentWriteSchema>;
