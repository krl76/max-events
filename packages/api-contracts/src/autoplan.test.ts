import { describe, expect, it } from "vitest";
import { CreateAutoPlanWriteSchema } from "./autoplan.js";

describe("CreateAutoPlanWriteSchema", () => {
  it("requires event id and origin coordinates", () => {
    expect(CreateAutoPlanWriteSchema.safeParse({ eventId: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90" }).success).toBe(false);
    expect(CreateAutoPlanWriteSchema.parse({ eventId: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90", latitude: 55.75, longitude: 37.62 }).latitude).toBe(55.75);
  });
});
