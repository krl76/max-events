import { afterEach, describe, expect, it } from "vitest";
import { ApiClient, organizerEntryCode } from "./client";
import { MOCK_ORGANIZER_PAID_EVENT_ID, installMockApi, mockEvents, resetMockOrganizer } from "./mock";

const UNKNOWN_ID = "99999999-0000-4000-8000-000000000999";

/** Слоты приходят ISO-мгновениями, а макет говорит о часах площадки — сравниваем в них же. */
const hhmm = (at: string) => new Date(at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

describe("mock organizer day and summary", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockOrganizer();
  });

  it("serves the period summary with seven weekday buckets and the traffic split", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");

    const summary = await api.getOrganizerSummary();

    expect(summary.byWeekday).toHaveLength(7);
    expect(summary.bookings).toBe(summary.byWeekday.reduce((sum, value) => sum + value, 0));
    expect(summary.sources.map((row) => row.source)).toEqual(["chats", "feed", "search"]);
    expect(summary.sources.reduce((sum, row) => sum + row.percent, 0)).toBe(100);
    // Доли берутся от того же ряда, что и число записей, иначе панель показывает «0% пришли» рядом с сотнями записей.
    expect(summary.attendedPercent).toBe(92);
    expect(summary.cancelledPercent).toBe(4);
  });

  it("defaults the экран 43 switches from the event itself and keeps a patch", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");

    const initial = await api.getOrganizerEventOptions(MOCK_ORGANIZER_PAID_EVENT_ID);
    // The seeded paid event is capped and pays off-site, so the defaults follow it rather than a guess.
    expect(initial).toMatchObject({ waitlistEnabled: true, registrationInApp: false, recurrence: null });
    expect(initial.externalUrl).not.toBeNull();

    const patched = await api.updateOrganizerEventOptions(MOCK_ORGANIZER_PAID_EVENT_ID, { recurrence: { rule: "weekly", until: "2026-10-31" } });
    expect(patched.recurrence).toEqual({ rule: "weekly", until: "2026-10-31" });
    expect((await api.getOrganizerEventOptions(MOCK_ORGANIZER_PAID_EVENT_ID)).recurrence).toEqual({ rule: "weekly", until: "2026-10-31" });
  });

  it("refuses to take registration off-site without a link to send it to", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");

    await expect(api.updateOrganizerEventOptions(mockEvents[0].id, {})).rejects.toMatchObject({ status: 403 });
    await expect(api.getOrganizerEventOptions(UNKNOWN_ID)).rejects.toMatchObject({ status: 404 });
  });

  it("builds the event day from the bookings the store already has", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");

    const day = await api.getOrganizerAttendance(MOCK_ORGANIZER_PAID_EVENT_ID);

    expect(day.bookedCount).toBe(day.participants.length);
    expect(day.checkedInCount).toBe(0);
    // One cancelled booking of the seeded fixtures is exactly one seat back on the table.
    expect(day.freedSeats).toBe(1);
    expect(day.waitlist.length).toBeGreaterThan(0);
    // Слоты — это день площадки, а не часы вокруг события: занят тот, в который событие попадает (19:00).
    expect(day.slots.map((slot) => `${hhmm(slot.startsAt)}–${hhmm(slot.endsAt)}`)).toEqual(["14:00–17:00", "17:30–20:30", "21:00–23:30"]);
    expect(day.slots.map((slot) => slot.busy)).toEqual([false, true, false]);
    expect(await api.listOrganizerBookings(MOCK_ORGANIZER_PAID_EVENT_ID)).toHaveLength(day.participants.length + 1);
  });

  it("checks a guest in by the code on their ticket, and only once", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");
    const [first] = (await api.getOrganizerAttendance(MOCK_ORGANIZER_PAID_EVENT_ID)).participants;

    const marked = await api.checkInOrganizerGuest(MOCK_ORGANIZER_PAID_EVENT_ID, organizerEntryCode(first.bookingId).toLowerCase());
    expect(marked.checkedInAt).not.toBeNull();
    expect((await api.getOrganizerAttendance(MOCK_ORGANIZER_PAID_EVENT_ID)).checkedInCount).toBe(1);

    // Повторный скан — не вторая отметка: время прихода остаётся тем же.
    expect((await api.checkInOrganizerGuest(MOCK_ORGANIZER_PAID_EVENT_ID, organizerEntryCode(first.bookingId))).checkedInAt).toBe(marked.checkedInAt);
    await expect(api.checkInOrganizerGuest(MOCK_ORGANIZER_PAID_EVENT_ID, "ZZZZZZ")).rejects.toMatchObject({ status: 404 });
  });

  it("never offers the waitlist more seats than were actually freed", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");

    expect(await api.inviteFromOrganizerWaitlist(MOCK_ORGANIZER_PAID_EVENT_ID, 4)).toEqual({ invited: 1 });
    const after = await api.getOrganizerAttendance(MOCK_ORGANIZER_PAID_EVENT_ID);
    expect(after.freedSeats).toBe(0);
    expect(await api.inviteFromOrganizerWaitlist(MOCK_ORGANIZER_PAID_EVENT_ID, 1)).toEqual({ invited: 0 });
  });
});
