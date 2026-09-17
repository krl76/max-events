import { describe, expect, it } from "vitest";
import { PeopleResponseSchema } from "./people.js";

describe("PeopleResponseSchema", () => {
  it("accepts an empty people payload", () => {
    expect(PeopleResponseSchema.parse({ nearbyCount: 0, lookingForCompanyTodayCount: 0, people: [] }).people).toEqual([]);
  });
});
