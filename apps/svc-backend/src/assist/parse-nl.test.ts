import { describe, expect, it } from "vitest";
import { applyKeywordGenre, parseAssistQuery } from "./parse-nl";

describe("parseAssistQuery", () => {
  it("parses the README evening music query", () => {
    expect(parseAssistQuery("Хочу вечером куда-нибудь, максимум 3000 ₽, с девушкой, желательно музыка")).toEqual({
      when: "evening",
      budgetMaxRub: 3000,
      company: "partner",
      genre: "music",
    });
  });

  it("treats a Saturday barbecue as an outdoors request", () => {
    expect(parseAssistQuery("План на субботу: шашлык").genre).toBe("outdoors");
  });

  it("reads volunteering even when the spelling drops the yo", () => {
    expect(parseAssistQuery("волонтерство").genre).toBe("volunteering");
    expect(parseAssistQuery("волонтёрский интенсив").genre).toBe("volunteering");
    const open = { when: "any" as const, budgetMaxRub: null, company: "alone" as const, genre: "any" as const };
    expect(applyKeywordGenre("волонтерство", open).genre).toBe("volunteering");
    expect(applyKeywordGenre("волонтерство", { ...open, genre: "music" }).genre).toBe("volunteering");
    expect(applyKeywordGenre("Спорт", open).genre).toBe("sport");
  });
});
