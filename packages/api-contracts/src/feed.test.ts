import { describe, expect, it } from "vitest";
import { CreateFeedPostWriteSchema, FeedPostSchema } from "./feed.js";

const author = { id: "018f3c5a-0000-7000-8000-000000000001", name: "Анна", avatarUrl: null };
const post = {
  id: "018f3c5a-0000-7000-8000-000000000080",
  author,
  eventId: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90",
  text: "Как прошло",
  likesCount: 2,
  likedByMe: false,
  comments: [{ id: "018f3c5a-0000-7000-8000-000000000081", author, text: "огонь" }],
};

describe("FeedPostSchema", () => {
  it("accepts a post with author, likes and comments", () => {
    expect(FeedPostSchema.parse(post).likesCount).toBe(2);
  });
});

describe("CreateFeedPostWriteSchema", () => {
  it("requires event and non-empty text", () => {
    expect(CreateFeedPostWriteSchema.safeParse({ eventId: post.eventId, text: "" }).success).toBe(false);
    expect(CreateFeedPostWriteSchema.parse({ eventId: post.eventId, text: "фото" }).text).toBe("фото");
  });
});
