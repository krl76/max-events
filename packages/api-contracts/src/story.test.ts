import { describe, expect, it } from "vitest";
import { CreateStoryWriteSchema, StorySchema } from "./story.js";

const validStory = {
  id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f",
  userId: "a0000000-0000-4000-8000-0000000000b1",
  imageUrl: "data:image/png;base64,xxxx",
  createdAt: "2026-09-16T10:00:00+03:00",
};

describe("StorySchema", () => {
  it("accepts a valid story", () => {
    expect(StorySchema.parse(validStory).audience).toBe("friends");
    expect(StorySchema.parse(validStory).sticker).toBeNull();
  });

  it("rejects an empty imageUrl or invalid ids", () => {
    expect(StorySchema.safeParse({ ...validStory, imageUrl: "" }).success).toBe(false);
    expect(StorySchema.safeParse({ ...validStory, userId: "nope" }).success).toBe(false);
  });
});

describe("CreateStoryWriteSchema objects", () => {
  it("keeps a canvas layout and rejects a scale off the client ladder", () => {
    const parsed = CreateStoryWriteSchema.parse({
      imageUrl: "data:image/png;base64,xxxx",
      objects: [{ kind: "text", x: 50, y: 20, scale: 1.15 }],
    });
    expect(parsed.objects?.[0]?.kind).toBe("text");
    expect(CreateStoryWriteSchema.safeParse({ imageUrl: "x", objects: [{ kind: "text", x: 50, y: 20, scale: 2 }] }).success).toBe(false);
    expect(CreateStoryWriteSchema.safeParse({ imageUrl: "x", objects: [{ kind: "logo", x: 0, y: 0 }] }).success).toBe(false);
  });
});
