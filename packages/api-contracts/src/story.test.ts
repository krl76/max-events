import { describe, expect, it } from "vitest";
import { StorySchema } from "./story.js";

const validStory = {
  id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f",
  userId: "a0000000-0000-4000-8000-0000000000b1",
  imageUrl: "data:image/png;base64,xxxx",
  createdAt: "2026-09-16T10:00:00+03:00",
};

describe("StorySchema", () => {
  it("accepts a valid story", () => {
    expect(StorySchema.safeParse(validStory).success).toBe(true);
  });

  it("rejects an empty imageUrl or invalid ids", () => {
    expect(StorySchema.safeParse({ ...validStory, imageUrl: "" }).success).toBe(false);
    expect(StorySchema.safeParse({ ...validStory, userId: "nope" }).success).toBe(false);
  });
});
