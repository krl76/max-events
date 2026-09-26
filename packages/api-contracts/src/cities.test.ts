import { describe, expect, it } from "vitest";
import { CitiesSchema } from "./cities.js";

describe("CitiesSchema", () => {
  it("accepts an empty directory and rejects a blank name", () => {
    expect(CitiesSchema.parse([])).toEqual([]);
    expect(CitiesSchema.parse(["Москва", "Казань"])).toEqual(["Москва", "Казань"]);
    expect(CitiesSchema.safeParse([""]).success).toBe(false);
  });
});
