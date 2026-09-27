import { describe, expect, it } from "vitest";
import { AcceptCalendarInviteWriteSchema, AddCalendarPeerWriteSchema, CalendarEntrySchema, CalendarResponseSchema, SharedCalendarSchema } from "./calendar.js";

const entry = {
  booking: {
    id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d91",
    userId: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f",
    eventId: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90",
    status: "active",
    createdAt: "2026-09-01T10:00:00+03:00",
    updatedAt: "2026-09-01T10:00:00+03:00",
  },
  event: {
    id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90",
    title: "Джаз в парке",
    category: "afisha",
    city: "Москва",
    startsAt: "2026-09-12T19:00:00+03:00",
  },
  place: null,
};

describe("CalendarEntrySchema", () => {
  it("accepts a booking with its event and a null place", () => {
    const parsed = CalendarEntrySchema.parse(entry);
    expect(parsed.place).toBeNull();
    expect(parsed.event.title).toBe("Джаз в парке");
  });

  it("rejects a cancelled-status-free payload missing the event", () => {
    expect(CalendarEntrySchema.safeParse({ booking: entry.booking, place: null }).success).toBe(false);
  });
});

describe("CalendarResponseSchema", () => {
  it("round-trips upcoming and past sections", () => {
    const parsed = CalendarResponseSchema.parse({ upcoming: [entry], past: [] });
    expect(parsed.upcoming).toHaveLength(1);
    expect(parsed.past).toEqual([]);
  });
});

const friend = { id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8e", name: "Анна", avatarUrl: null };
const shared = {
  peers: [{ friend, canEdit: true }],
  entries: [
    {
      id: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d92",
      owner: friend,
      title: "Джаз в парке",
      startsAt: "2026-09-12T19:00:00+03:00",
      endsAt: null,
      bothGoing: false,
      needsResponse: true,
      eventId: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90",
    },
  ],
  inviteUrl: "https://max.ru/se14352055_bot?startapp=calendar-018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d93",
};

describe("SharedCalendarSchema", () => {
  it("accepts peers, entries and a nullable invite link", () => {
    expect(SharedCalendarSchema.parse(shared).inviteUrl).toContain("startapp=calendar-");
    expect(SharedCalendarSchema.parse({ ...shared, inviteUrl: null }).inviteUrl).toBeNull();
  });

  it("rejects an entry that is missing the owner", () => {
    const [{ owner: _owner, ...row }] = shared.entries;
    expect(SharedCalendarSchema.safeParse({ ...shared, entries: [row] }).success).toBe(false);
  });
});

describe("AddCalendarPeerWriteSchema", () => {
  it("accepts a user id and treats canEdit as optional", () => {
    expect(AddCalendarPeerWriteSchema.parse({ userId: friend.id })).toEqual({ userId: friend.id });
    expect(AddCalendarPeerWriteSchema.parse({ userId: friend.id, canEdit: false }).canEdit).toBe(false);
  });

  it("rejects a non-uuid peer", () => {
    expect(AddCalendarPeerWriteSchema.safeParse({ userId: "anna" }).success).toBe(false);
  });
});

describe("AcceptCalendarInviteWriteSchema", () => {
  it("rejects a non-uuid token", () => {
    expect(AcceptCalendarInviteWriteSchema.safeParse({ token: "invite" }).success).toBe(false);
  });
});
