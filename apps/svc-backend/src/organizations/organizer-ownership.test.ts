import { describe, expect, it } from "vitest";
import { isOrganizerOwner } from "./organizer-ownership";

describe("isOrganizerOwner", () => {
  it("matches the organization id or the linked organizer user, and skips the check without an actor", () => {
    const row = { organizerUserId: "user-1", organizerOrganizationId: "org-1" };
    expect(isOrganizerOwner(row)).toBe(true);
    expect(isOrganizerOwner(row, "org-1")).toBe(true);
    expect(isOrganizerOwner(row, "user-1")).toBe(true);
    expect(isOrganizerOwner(row, "other")).toBe(false);
  });
});
