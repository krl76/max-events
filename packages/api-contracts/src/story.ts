// START_MODULE_CONTRACT
// PURPOSE: Zod contract for a story (photo published to the stories rail) plus composition write fields.
// SCOPE: Story read shape; CreateStoryWrite for POST /stories (image, optional sticker/poll/audience).
// DEPENDS: zod
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - StorySchema - story (id, userId, imageUrl, createdAt)
// - Story - story type
// END_MODULE_MAP

import { z } from "zod";

export const StoryAudienceSchema = z.enum(["close-friends", "friends", "city"]);
export type StoryAudience = z.infer<typeof StoryAudienceSchema>;

export const StoryPlaceStickerSchema = z.object({
  eventId: z.string().uuid(),
  title: z.string().min(1).max(200),
  subtitle: z.string().min(1).max(300),
  seatsLeft: z.number().int().min(0).nullable(),
});
export type StoryPlaceSticker = z.infer<typeof StoryPlaceStickerSchema>;

export const StoryPollSchema = z.object({
  question: z.string().min(1).max(200),
  options: z.array(z.string().min(1).max(80)).min(2).max(4),
  answer: z.number().int().min(0).nullable(),
});
export type StoryPoll = z.infer<typeof StoryPollSchema>;

export const STORY_OBJECT_KINDS = ["text", "event", "poll", "seats"] as const;
export const StoryObjectKindSchema = z.enum(STORY_OBJECT_KINDS);
export type StoryObjectKind = z.infer<typeof StoryObjectKindSchema>;

export const STORY_OBJECT_SCALES = [0.75, 0.9, 1, 1.15, 1.25] as const;
export const StoryObjectScaleSchema = z.union([z.literal(0.75), z.literal(0.9), z.literal(1), z.literal(1.15), z.literal(1.25)]);

export const StoryCanvasObjectSchema = z.object({
  id: z.string().min(1).max(40).optional(),
  kind: StoryObjectKindSchema,
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  scale: StoryObjectScaleSchema.optional(),
  text: z.string().max(500).optional(),
});
export type StoryCanvasObject = z.infer<typeof StoryCanvasObjectSchema>;

export const CreateStoryWriteSchema = z.object({
  imageUrl: z.string().min(1),
  text: z.string().max(500).optional(),
  sticker: StoryPlaceStickerSchema.nullable().optional(),
  poll: StoryPollSchema.nullable().optional(),
  audience: StoryAudienceSchema.optional(),
  objects: z.array(StoryCanvasObjectSchema).max(20).optional(),
});
export type CreateStoryWrite = z.infer<typeof CreateStoryWriteSchema>;

export const StoryPollVoteWriteSchema = z.object({
  optionIndex: z.number().int().min(0).max(3),
});
export type StoryPollVoteWrite = z.infer<typeof StoryPollVoteWriteSchema>;

export const StorySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  imageUrl: z.string().min(1),
  text: z.string().default(""),
  sticker: StoryPlaceStickerSchema.nullable().default(null),
  poll: StoryPollSchema.nullable().default(null),
  audience: StoryAudienceSchema.default("friends"),
  objects: z.array(StoryCanvasObjectSchema).default([]),
  createdAt: z.string().min(1),
});
export type Story = z.infer<typeof StorySchema>;
