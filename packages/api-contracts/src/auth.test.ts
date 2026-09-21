import { describe, expect, it } from "vitest";
import { AuthRequestSchema, AuthResponseSchema, BrowserInitDataSchema, OrganizerLoginWriteSchema, OrganizerSessionSchema } from "./auth.js";

const validOrganization = {
  id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f",
  name: "Городские события",
  contacts: "org@example.com",
};

const validUser = {
  id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f",
  maxUserId: "67890",
  firstName: "Max",
  lastName: null,
  avatarUrl: null,
  createdAt: "2026-09-01T10:00:00+03:00",
  updatedAt: "2026-09-01T10:00:00+03:00",
};

describe("AuthRequestSchema", () => {
  it("accepts a non-empty initData string", () => {
    expect(AuthRequestSchema.safeParse({ initData: "auth_date=1&hash=abc" }).success).toBe(true);
  });

  it("rejects an empty or missing initData", () => {
    expect(AuthRequestSchema.safeParse({ initData: "" }).success).toBe(false);
    expect(AuthRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe("AuthResponseSchema", () => {
  it("reuses the User contract for the authenticated user", () => {
    const parsed = AuthResponseSchema.parse({ user: validUser });
    expect(parsed.user.maxUserId).toBe("67890");
  });

  it("rejects a response without a valid user", () => {
    expect(AuthResponseSchema.safeParse({ user: { ...validUser, maxUserId: "" } }).success).toBe(false);
  });
});

describe("OrganizerLoginWriteSchema", () => {
  it("accepts non-empty credentials", () => {
    expect(OrganizerLoginWriteSchema.safeParse({ login: "demo", password: "demo" }).success).toBe(true);
  });

  it("rejects empty login or password", () => {
    expect(OrganizerLoginWriteSchema.safeParse({ login: "", password: "x" }).success).toBe(false);
    expect(OrganizerLoginWriteSchema.safeParse({ login: "x", password: "" }).success).toBe(false);
  });
});

describe("OrganizerSessionSchema", () => {
  it("accepts a token with an organization", () => {
    const parsed = OrganizerSessionSchema.parse({ token: "jwt", organization: validOrganization });
    expect(parsed.organization.name).toBe("Городские события");
  });

  it("rejects an empty token", () => {
    expect(OrganizerSessionSchema.safeParse({ token: "", organization: validOrganization }).success).toBe(false);
  });
});

describe("BrowserInitDataSchema", () => {
  it("accepts a non-empty initData string", () => {
    expect(BrowserInitDataSchema.parse({ initData: "auth_date=1&hash=abc" }).initData).toBe("auth_date=1&hash=abc");
  });

  it("rejects an empty initData", () => {
    expect(BrowserInitDataSchema.safeParse({ initData: "" }).success).toBe(false);
  });
});
