import { describe, expect, it } from "vitest";
import { CreateFeedPostWriteSchema, FeedPostSchema, MAX_FEED_PHOTO_URL_LENGTH } from "./feed.js";

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

describe("feed post photo", () => {
  it("accepts a stored data URL and an uploaded https one, and refuses what is not a url", () => {
    const dataUrl = `data:image/jpeg;base64,${"A".repeat(1000)}`;

    expect(FeedPostSchema.parse({ ...post, photoUrl: dataUrl }).photoUrl).toBe(dataUrl);
    expect(FeedPostSchema.parse({ ...post, photoUrl: "https://cdn.example.com/p.jpg" }).photoUrl).toBe("https://cdn.example.com/p.jpg");
    expect(FeedPostSchema.safeParse({ ...post, photoUrl: "нет" }).success).toBe(false);
  });

  it("caps the photo at the payload budget", () => {
    // The photo rides inside the request body until object storage lands, so the cap is a budget.
    const tooLong = `data:image/jpeg;base64,${"A".repeat(MAX_FEED_PHOTO_URL_LENGTH)}`;

    expect(tooLong.length).toBeGreaterThan(MAX_FEED_PHOTO_URL_LENGTH);
    expect(FeedPostSchema.safeParse({ ...post, photoUrl: tooLong }).success).toBe(false);
    expect(CreateFeedPostWriteSchema.safeParse({ eventId: post.eventId, text: "Как прошло", photoUrl: tooLong }).success).toBe(false);
  });
});

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
