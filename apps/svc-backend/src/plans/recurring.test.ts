import { describe, expect, it } from "vitest";
import { moscowIsoWeekday, nextRecurringAt, upcomingRecurringAts } from "./recurring";

describe("recurring plan dates", () => {
  it("steps a weekly Thursday series by seven days", () => {
    const from = new Date("2026-09-10T19:00:00+03:00");
    expect(moscowIsoWeekday(from)).toBe(4);
    const next = nextRecurringAt(from, { type: "weekly_weekday", weekday: 4 }, from);
    expect(next.toISOString()).toBe(new Date("2026-09-17T19:00:00+03:00").toISOString());
    const upcoming = upcomingRecurringAts(from, { type: "weekly_weekday", weekday: 4 }, from, 2);
    expect(upcoming.map((row) => row.toISOString())).toEqual([new Date("2026-09-17T19:00:00+03:00").toISOString(), new Date("2026-09-24T19:00:00+03:00").toISOString()]);
  });

  it("finds the first Saturday of the next month", () => {
    const from = new Date("2026-09-05T11:00:00+03:00");
    expect(moscowIsoWeekday(from)).toBe(6);
    const next = nextRecurringAt(from, { type: "monthly_nth_weekday", nth: 1, weekday: 6 }, from);
    expect(moscowIsoWeekday(next)).toBe(6);
    expect(next.toISOString()).toBe(new Date("2026-10-03T11:00:00+03:00").toISOString());
  });

  it("uses the last Thursday of a short month when nth is 5", () => {
    const from = new Date("2026-01-29T19:00:00+03:00");
    const next = nextRecurringAt(from, { type: "monthly_nth_weekday", nth: 5, weekday: 4 }, from);
    expect(next.toISOString()).toBe(new Date("2026-02-26T19:00:00+03:00").toISOString());
  });

  it("jumps a nine-year-old weekly series to four future dates", () => {
    const from = new Date("2017-09-07T19:00:00+03:00");
    const after = new Date("2026-09-12T10:00:00.000Z");
    const upcoming = upcomingRecurringAts(from, { type: "weekly_weekday", weekday: 4 }, after, 4);
    expect(upcoming.map((row) => row.toISOString())).toEqual([new Date("2026-09-17T19:00:00+03:00").toISOString(), new Date("2026-09-24T19:00:00+03:00").toISOString(), new Date("2026-10-01T19:00:00+03:00").toISOString(), new Date("2026-10-08T19:00:00+03:00").toISOString()]);
    expect(new Set(upcoming.map((row) => row.getTime())).size).toBe(4);
    expect(upcoming.every((row) => row.getTime() > after.getTime())).toBe(true);
  });
});
