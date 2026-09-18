import { describe, expect, it } from "vitest";
import { AssistQueryWriteSchema, AssistResponseSchema } from "./assist.js";

describe("AssistQueryWriteSchema", () => {
  it("accepts the README NL query and rejects an empty string", () => {
    expect(AssistQueryWriteSchema.parse({ query: "Хочу вечером куда-нибудь, максимум 3000 ₽, с девушкой, желательно музыка" }).query).toContain("вечером");
    expect(AssistQueryWriteSchema.safeParse({ query: "" }).success).toBe(false);
  });
});

describe("AssistResponseSchema", () => {
  it("requires a summary and criteria", () => {
    expect(
      AssistResponseSchema.safeParse({
        summary: "Нашел 0 вариантов",
        criteria: { when: "evening", budgetMaxRub: 3000, company: "partner", genre: "music" },
        items: [],
      }).success,
    ).toBe(true);
    expect(AssistResponseSchema.safeParse({ summary: "x", criteria: { when: "night" }, items: [] }).success).toBe(false);
  });
});
