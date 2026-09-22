import { describe, expect, it } from "vitest";
import { mockEvents, mockPlaces } from "../api/mock";
import { buildCalendarIcs, icsStamp } from "./calendar-ics";
import type { CalendarEntry } from "../api/client";

describe("buildCalendarIcs", () => {
  it("emits a VEVENT per booking and a VCALENDAR wrapper", () => {
    const event = mockEvents[0];
    const entry: CalendarEntry = {
      booking: { id: "e0000000-0000-4000-8000-000000000099", userId: "u1", eventId: event.id, status: "active", createdAt: event.startsAt, updatedAt: event.startsAt },
      event,
      place: mockPlaces[0] ?? null,
    };
    const ics = buildCalendarIcs([entry]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain(`UID:${entry.booking.id}@max-events`);
    expect(ics).toContain(`SUMMARY:${event.title}`);
    expect(ics).toContain(`DTSTART:${icsStamp(event.startsAt)}`);
    expect(ics).toContain("END:VCALENDAR");
  });

  it("returns an empty calendar when there are no bookings", () => {
    const ics = buildCalendarIcs([]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});
