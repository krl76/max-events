// START_MODULE_CONTRACT
// PURPOSE: Feed and stories endpoints of the api client: the stories rail and the impression wall with its likes and comments.
// SCOPE: GET/POST /stories, GET/POST /feed, POST /feed/:id/like, POST /feed/:id/comments.
// DEPENDS: ./transport.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - FeedPost - impression post aggregate: author, event, text, like counter/state, comments
// - FeedComment - post comment attributed to its author
// - CreateFeedPost - impression publication payload (author, event, text, optional photo); the userId field is a mock-only convenience ignored by the real backend (identity comes from the init-data token)
// - withFeed - ApiClient.listStories / createStory / listFeedPosts / createFeedPost / toggleFeedLike / addFeedComment
// END_MODULE_MAP

import { FeedPostSchema, StorySchema } from "@max-events/api-contracts";
import type { FeedComment as ContractFeedComment, FeedPost as ContractFeedPost, Story } from "@max-events/api-contracts";
import type { ApiMixin } from "./transport";

/** Feed comment attributed to its author. */
export type FeedComment = ContractFeedComment;

/** Impression post aggregate: author, event, text, like counter/state and comments; the photo is a CSS placeholder. */
export type FeedPost = ContractFeedPost;

/** Impression publication payload: the author, the event the post is about and the text. */
export interface CreateFeedPost {
  userId: string;
  eventId: string;
  text: string;
  /** Optional photo for the post; the server stores the url as given. */
  photoUrl?: string | null;
}

export function withFeed<TBase extends ApiMixin>(Base: TBase) {
  return class FeedEndpoints extends Base {
    listStories(): Promise<Story[]> {
      return this.request("/stories", StorySchema.array());
    }

    createStory(imageUrl: string): Promise<Story> {
      return this.request("/stories", StorySchema, { body: { imageUrl } });
    }

    listFeedPosts(eventId?: string, placeId?: string): Promise<FeedPost[]> {
      const query = eventId !== undefined ? `?eventId=${encodeURIComponent(eventId)}` : placeId !== undefined ? `?placeId=${encodeURIComponent(placeId)}` : "";
      return this.request(`/feed${query}`, FeedPostSchema.array());
    }

    createFeedPost(payload: CreateFeedPost): Promise<FeedPost> {
      return this.request("/feed", FeedPostSchema, { body: payload });
    }

    /** Toggle a feed like; the userId param is ignored server-side, identity comes from initData. */
    toggleFeedLike(postId: string, userId: string): Promise<FeedPost> {
      return this.request(`/feed/${postId}/like?userId=${encodeURIComponent(userId)}`, FeedPostSchema, { method: "POST" });
    }

    addFeedComment(postId: string, payload: { userId: string; text: string }): Promise<FeedPost> {
      return this.request(`/feed/${postId}/comments`, FeedPostSchema, { body: payload });
    }
  };
}
