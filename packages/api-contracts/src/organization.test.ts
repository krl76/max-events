import { describe, expect, it } from "vitest";
import { OrganizationSchema } from "./organization.js";

const validOrganization = {
  id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f",
  name: "Городские события",
  contacts: null,
};

describe("OrganizationSchema", () => {
  it("accepts a valid organization", () => {
    expect(OrganizationSchema.safeParse(validOrganization).success).toBe(true);
  });

  it("rejects an empty name or invalid id", () => {
    expect(OrganizationSchema.safeParse({ ...validOrganization, name: "" }).success).toBe(false);
    expect(OrganizationSchema.safeParse({ ...validOrganization, id: "not-a-uuid" }).success).toBe(false);
  });
});
