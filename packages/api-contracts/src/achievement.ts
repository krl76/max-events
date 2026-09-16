// START_MODULE_CONTRACT
// PURPOSE: Zod contracts for achievements ("штампы") with meaningful thresholds from README.
// SCOPE: Achievement code enum (city explorer, music fan, weekend city, volunteer), Achievement entity with progress.
// DEPENDS: zod, ./primitives.js
// LINKS: M-PKG-API-CONTRACTS, V-M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AchievementCodeSchema - closed achievement code enum from README
// - AchievementCode - achievement code type
// - AchievementSchema - achievement entity (code, title, threshold, progress, grant date when granted)
// - Achievement - achievement type
// END_MODULE_MAP

import { z } from "zod";
import { TimestampSchema } from "./primitives.js";

export const AchievementCodeSchema = z.enum(["city_explorer", "music_fan", "weekend_city", "volunteer"]);
export type AchievementCode = z.infer<typeof AchievementCodeSchema>;

export const AchievementSchema = z
  .object({
    code: AchievementCodeSchema,
    title: z.string().min(1).max(200),
    threshold: z.number().int().min(1),
    progress: z.number().int().min(0).default(0),
    grantedAt: TimestampSchema.nullable().default(null),
  })
  .refine((data) => data.progress <= data.threshold, {
    message: "progress cannot exceed threshold",
    path: ["progress"],
  });
export type Achievement = z.infer<typeof AchievementSchema>;
