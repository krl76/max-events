import { describe, expect, it } from "vitest";
import { OrganizerEventOptionsSchema, UpdateOrganizerEventOptionsSchema, WaitlistInviteWriteSchema } from "./organizer-day.js";

const eventId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f";

describe("OrganizerEventOptionsSchema", () => {
  it("accepts the four экран 46 switches", () => {
    const parsed = OrganizerEventOptionsSchema.parse({
      eventId,
      waitlistEnabled: true,
      registrationInApp: true,
      externalUrl: null,
      recurrence: null,
    });
    expect(parsed.waitlistEnabled).toBe(true);
  });
});

describe("UpdateOrganizerEventOptionsSchema", () => {
  it("keeps omitted keys omitted", () => {
    const parsed = UpdateOrganizerEventOptionsSchema.parse({ waitlistEnabled: false });
    expect(parsed).toEqual({ waitlistEnabled: false });
    expect("registrationInApp" in parsed).toBe(false);
  });
});

describe("WaitlistInviteWriteSchema", () => {
  it("rejects a zero or huge invite count", () => {
    expect(WaitlistInviteWriteSchema.safeParse({ count: 0 }).success).toBe(false);
    expect(WaitlistInviteWriteSchema.parse({ count: 3 }).count).toBe(3);
  });
});
