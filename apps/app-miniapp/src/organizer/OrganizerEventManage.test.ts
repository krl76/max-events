import { describe, expect, it } from "vitest";
import type { OrganizerParticipant } from "../api/client";
import { fillPercent, formatArrival, formatBookedAgo, formatSlot, guestsNote, participantFilterCounts, participantInitial, participantNote, reviewRecommendShare, reviewVerdict, splitParticipants } from "./OrganizerEventManage";

const participant = (over: Partial<OrganizerParticipant> = {}): OrganizerParticipant => ({ bookingId: "e00000f2-0000-4000-8000-0000000000f1", userId: "a0000000-0000-4000-8000-0000000000b1", name: "Анна Мельник", guests: 1, checkedInAt: null, bookedAt: "2026-09-16T12:00:00+03:00", ...over });

describe("splitParticipants", () => {
  it("puts the roster in the two groups the screen names", () => {
    const groups = splitParticipants([participant({ checkedInAt: "2026-09-19T13:52:00+03:00" }), participant({ bookingId: "e00000f2-0000-4000-8000-0000000000f2", name: "Марина Ким" })]);

    expect(groups.arrived.map((row) => row.name)).toEqual(["Анна Мельник"]);
    expect(groups.expected.map((row) => row.name)).toEqual(["Марина Ким"]);
  });
});

describe("fillPercent", () => {
  it("measures against the capacity and never runs past the bar", () => {
    expect(fillPercent(16, 20)).toBe(80);
    expect(fillPercent(25, 20)).toBe(100);
  });

  it("stays at zero without a capacity, because an uncapped event has no fill to claim", () => {
    expect(fillPercent(16, null)).toBe(0);
    expect(fillPercent(16, 0)).toBe(0);
  });
});

describe("formatArrival", () => {
  it("says when somebody arrived without guessing their gender", () => {
    const line = formatArrival("2026-09-19T13:52:00+03:00");

    expect(line).toContain("на месте с");
    expect(line).not.toMatch(/пришла|пришёл/);
  });
});

describe("formatBookedAgo", () => {
  const now = new Date("2026-09-19T14:00:00+03:00");

  it("counts the days up to a week and then names the date", () => {
    expect(formatBookedAgo("2026-09-19T10:00:00+03:00", now)).toBe("запись сегодня");
    expect(formatBookedAgo("2026-09-18T10:00:00+03:00", now)).toBe("запись вчера");
    expect(formatBookedAgo("2026-09-17T10:00:00+03:00", now)).toBe("запись 2 дня назад");
    expect(formatBookedAgo("2026-09-01T10:00:00+03:00", now)).toBe("запись 1 сентября");
  });
});

describe("formatSlot", () => {
  it("reads the window and whether it is taken", () => {
    expect(formatSlot({ id: "slot-0", startsAt: "2026-09-19T14:00:00+03:00", endsAt: "2026-09-19T17:00:00+03:00", busy: true })).toBe("14:00–17:00 · занят");
    expect(formatSlot({ id: "slot-1", startsAt: "2026-09-19T17:30:00+03:00", endsAt: "2026-09-19T20:30:00+03:00", busy: false })).toBe("17:30–20:30 · свободен");
  });
});

describe("participantNote", () => {
  it("shows arrival time after check-in and guests before", () => {
    expect(participantNote(participant({ guests: 1 }))).toBe("+1 гость");
    expect(participantNote(participant({ guests: 0, checkedInAt: "2026-09-19T13:52:00+03:00" }))).toContain("на месте с");
  });
});

describe("participantFilterCounts", () => {
  it("splits the roster into the four chips", () => {
    const counts = participantFilterCounts({
      eventId: "e",
      capacity: 10,
      bookedCount: 2,
      waitlistCount: 1,
      checkedInCount: 1,
      freedSeats: 0,
      chatMessages: null,
      participants: [participant({ checkedInAt: "2026-09-19T13:52:00+03:00" }), participant({ bookingId: "e00000f2-0000-4000-8000-0000000000f2", checkedInAt: null })],
      waitlist: [{ entryId: "w1", userId: "u", name: "Кира", guests: 0, joinedAt: "2026-09-18T12:00:00+03:00" }],
      slots: [],
    });
    expect(counts).toEqual({ all: 2, in: 1, out: 1, wait: 1 });
  });
});

describe("guestsNote", () => {
  it("counts companions and says nothing when there are none", () => {
    expect(guestsNote(0)).toBe("");
    expect(guestsNote(1)).toBe("+1 гость");
    expect(guestsNote(3)).toBe("+3 гостя");
  });
});

describe("participantInitial", () => {
  it("takes the first letter and never renders an empty avatar", () => {
    expect(participantInitial("Анна Мельник")).toBe("А");
    expect(participantInitial("  ")).toBe("?");
  });
});

describe("reviewVerdict", () => {
  it("maps the guest answers the after-event screen asks", () => {
    expect(reviewVerdict(2, false)).toBe("Не моё");
    expect(reviewVerdict(3, false)).toBe("Норм");
    expect(reviewVerdict(5, false)).toBe("Отлично");
    expect(reviewVerdict(5, true)).toBe("Ещё раз");
  });
});

describe("reviewRecommendShare", () => {
  it("is the share of «Ещё раз» among reviews", () => {
    expect(reviewRecommendShare([])).toBeNull();
    expect(reviewRecommendShare([{ wouldGoAgain: true }, { wouldGoAgain: false }, { wouldGoAgain: true }] as never)).toBe(67);
  });
});
