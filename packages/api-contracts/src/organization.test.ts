import { describe, expect, it } from "vitest";
import { OrganizationSchema, OrganizerSetupSchema, UpdateOrganizerSetupSchema } from "./organization.js";

const organizationId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f";
const placeId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90";

const validOrganization = {
  id: organizationId,
  name: "Городские события",
  contacts: null,
};

const validSetup = {
  organizationId,
  step: "venue",
  completedAt: null,
  venue: { placeId, title: "Парк Горького", address: "Крымский Вал, 9", city: "Москва" },
  activities: ["events", "slots"],
  payouts: { mode: "none", paymentUrl: null, contacts: null },
};

describe("OrganizationSchema", () => {
  it("accepts a valid organization and defaults activities to empty", () => {
    expect(OrganizationSchema.parse(validOrganization).activities).toEqual([]);
    expect(OrganizationSchema.parse({ ...validOrganization, activities: ["tours"] }).activities).toEqual(["tours"]);
  });

  it("rejects an empty name, invalid id, or unknown activity", () => {
    expect(OrganizationSchema.safeParse({ ...validOrganization, name: "" }).success).toBe(false);
    expect(OrganizationSchema.safeParse({ ...validOrganization, id: "not-a-uuid" }).success).toBe(false);
    expect(OrganizationSchema.safeParse({ ...validOrganization, activities: ["катание"] }).success).toBe(false);
  });
});

describe("OrganizerSetupSchema", () => {
  it("accepts a venue-step setup and an external payout link", () => {
    expect(OrganizerSetupSchema.parse(validSetup).step).toBe("venue");
    expect(OrganizerSetupSchema.parse({ ...validSetup, step: "payouts", payouts: { mode: "external", paymentUrl: "https://pay.example.com/gorky", contacts: "org@example.com" } }).payouts.mode).toBe("external");
  });

  it("rejects an unknown step, activity, or a payout link that is not a URL", () => {
    expect(OrganizerSetupSchema.safeParse({ ...validSetup, step: "logo" }).success).toBe(false);
    expect(OrganizerSetupSchema.safeParse({ ...validSetup, activities: ["events", "катание"] }).success).toBe(false);
    expect(OrganizerSetupSchema.safeParse({ ...validSetup, payouts: { mode: "external", paymentUrl: "касса на входе", contacts: null } }).success).toBe(false);
  });
});

describe("UpdateOrganizerSetupSchema", () => {
  it("accepts an empty patch and a partial venue", () => {
    expect(UpdateOrganizerSetupSchema.parse({}).step).toBeUndefined();
    expect(UpdateOrganizerSetupSchema.parse({ step: "payouts", venue: { title: "Парк" } }).venue).toEqual({ title: "Парк" });
  });

  it("rejects an unknown activity in a patch", () => {
    expect(UpdateOrganizerSetupSchema.safeParse({ activities: ["events", "катание"] }).success).toBe(false);
  });
});
