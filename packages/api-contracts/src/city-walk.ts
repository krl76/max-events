import { z } from "zod";
import { IdSchema, TimestampSchema } from "./primitives.js";
import { LatitudeSchema, LongitudeSchema } from "./place.js";
import { RouteLegSchema } from "./route.js";

export const WalkInterestSchema = z.enum(["cultural", "iconic", "parks", "history", "architecture", "unusual"]);
export type WalkInterest = z.infer<typeof WalkInterestSchema>;

export const WalkBudgetModeSchema = z.enum(["free", "any", "custom"]);
export type WalkBudgetMode = z.infer<typeof WalkBudgetModeSchema>;

export const WalkSourceLabelSchema = z.enum(["catalog", "web", "mixed"]);
export type WalkSourceLabel = z.infer<typeof WalkSourceLabelSchema>;

const SourceUrlSchema = z.string().refine((value) => value.startsWith("https://") || value.startsWith("http://") || value.startsWith("app://places/"), "source url");

export const ComposeCityWalkWriteSchema = z
  .object({
    city: z.string().min(1),
    durationMinutes: z.number().int().min(30).max(480),
    budgetMode: WalkBudgetModeSchema,
    budgetRub: z.number().int().min(0).max(100_000).nullable(),
    interests: z.array(WalkInterestSchema).min(1),
    excludeKeys: z.array(z.string()).default([]),
  })
  .superRefine((value, ctx) => {
    const custom = value.budgetMode === "custom";
    if (custom && value.budgetRub === null) {
      ctx.addIssue({ code: "custom", message: "custom budget requires budgetRub", path: ["budgetRub"] });
    }
    if (!custom && value.budgetRub !== null) {
      ctx.addIssue({ code: "custom", message: "budgetRub is only for custom", path: ["budgetRub"] });
    }
  });
export type ComposeCityWalkWrite = z.infer<typeof ComposeCityWalkWriteSchema>;

export const CityWalkStopSchema = z.object({
  order: z.number().int().min(1),
  title: z.string().min(1),
  address: z.string().min(1),
  latitude: LatitudeSchema,
  longitude: LongitudeSchema,
  description: z.string().min(1),
  sourceUrl: SourceUrlSchema,
  placeId: IdSchema.nullable(),
  done: z.boolean(),
  /** Commons photograph of the sight, when Wikidata has one. */
  imageUrl: z
    .string()
    .refine((value) => value.startsWith("https://"), "https image")
    .optional(),
});
export type CityWalkStop = z.infer<typeof CityWalkStopSchema>;

export const CityWalkSchema = z.object({
  id: IdSchema,
  city: z.string().min(1),
  durationMinutes: z.number().int().min(30).max(480),
  budgetMode: WalkBudgetModeSchema,
  budgetRub: z.number().int().min(0).max(100_000).nullable(),
  interests: z.array(WalkInterestSchema).min(1),
  sourceLabel: WalkSourceLabelSchema,
  fitted: z.boolean(),
  stops: z.array(CityWalkStopSchema).min(2).max(6),
  legs: z.array(RouteLegSchema),
  createdAt: TimestampSchema,
});
export type CityWalk = z.infer<typeof CityWalkSchema>;

export const SetCityWalkStopDoneWriteSchema = z.object({
  done: z.boolean(),
});
export type SetCityWalkStopDoneWrite = z.infer<typeof SetCityWalkStopDoneWriteSchema>;
