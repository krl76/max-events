import { describe, expect, it } from "vitest";
import { ORGANIZER_PROMO_TOOLS, barHeights, eventFillNote, formatCount, needsPromotion, trafficLead } from "./OrganizerDashboard";

describe("barHeights", () => {
  it("scales to the busiest day and marks the two peaks", () => {
    const bars = barHeights([18, 26, 22, 37, 48, 61, 33]);

    expect(bars).toHaveLength(7);
    expect(bars[5].height).toBe(100);
    expect(bars.filter((bar) => bar.accent).map((bar, _index) => bar.height)).toEqual([79, 100]);
  });

  it("draws nothing rather than a full chart when the week is empty", () => {
    expect(barHeights([0, 0, 0, 0, 0, 0, 0]).every((bar) => bar.height === 0 && !bar.accent)).toBe(true);
  });
});

describe("trafficLead", () => {
  it("leads with the biggest source and lists the rest behind it", () => {
    expect(
      trafficLead([
        { source: "chats", percent: 62 },
        { source: "feed", percent: 24 },
        { source: "search", percent: 14 },
      ]),
    ).toEqual({ lead: "62% из чатов", rest: "24% лента · 14% поиск" });
  });

  it("says so instead of inventing a leader when nothing was counted", () => {
    expect(trafficLead([])).toEqual({ lead: "Пока не из чего считать", rest: "" });
  });
});

describe("eventFillNote", () => {
  it("reads «16 из 20» and adds the waitlist only when somebody is waiting", () => {
    expect(eventFillNote({ booked: 16, waitlist: 7 }, 20)).toBe("16 из 20 · лист ожидания 7");
    expect(eventFillNote({ booked: 16, waitlist: 0 }, 20)).toBe("16 из 20");
  });

  it("counts plainly where no capacity caps the event", () => {
    expect(eventFillNote({ booked: 11, waitlist: 0 }, null)).toBe("11 записей");
    expect(eventFillNote(undefined, 40)).toBe("до 40 мест");
    expect(eventFillNote(undefined, null)).toBe("Без предела мест");
  });
});

describe("needsPromotion", () => {
  it("offers to promote only a half-empty event nobody is waiting for", () => {
    expect(needsPromotion({ booked: 11, waitlist: 0 }, 40)).toBe(true);
    expect(needsPromotion({ booked: 16, waitlist: 0 }, 20)).toBe(false);
    // Somebody already waiting is the opposite of a promotion problem.
    expect(needsPromotion({ booked: 11, waitlist: 3 }, 40)).toBe(false);
    expect(needsPromotion({ booked: 11, waitlist: 0 }, null)).toBe(false);
  });
});

describe("formatCount", () => {
  it("groups thousands the way the hero prints them", () => {
    // The separator is a non-breaking space on purpose: a number must not wrap in the middle.
    expect(formatCount(1284)).toBe("1\u00a0284");
    expect(formatCount(92)).toBe("92");
  });
});

describe("ORGANIZER_PROMO_TOOLS", () => {
  it("carries the four tiles of the design, each with its own intent", () => {
    expect(ORGANIZER_PROMO_TOOLS.map((tool) => tool.intent)).toEqual(["target_collection", "boost", "promocode", "report"]);
    expect(ORGANIZER_PROMO_TOOLS.every((tool) => tool.title !== "" && tool.note !== "")).toBe(true);
  });
});
