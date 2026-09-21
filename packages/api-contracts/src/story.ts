// START_MODULE_CONTRACT
// PURPOSE: Zod contract for a story (photo published to the stories rail).
// SCOPE: Story read shape only; story upload/list endpoints live behind the mock until the backend API lands.
// DEPENDS: zod
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - StorySchema - story (id, userId, imageUrl, createdAt)
// - Story - story type
// END_MODULE_MAP

import { z } from "zod";

export const StorySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  imageUrl: z.string().min(1),
  createdAt: z.string().min(1),
});
export type Story = z.infer<typeof StorySchema>;
