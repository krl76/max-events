import { describe, expect, it } from "vitest";
import { parseAssistQuery } from "./parse-nl";

describe("parseAssistQuery", () => {
  it("parses the README evening music query", () => {
    expect(parseAssistQuery("Хочу вечером куда-нибудь, максимум 3000 ₽, с девушкой, желательно музыка")).toEqual({
      when: "evening",
      budgetMaxRub: 3000,
      company: "partner",
      genre: "music",
    });
  });
});
