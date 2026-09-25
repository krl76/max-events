import { beforeEach, describe, expect, it } from "vitest";
import { completeMockOrganizerSetup, mockOrganizerSetup, resetMockOrganizerSetup, updateMockOrganizerSetup } from "./organizer";

beforeEach(() => {
  resetMockOrganizerSetup();
});

describe("mockOrganizerSetup", () => {
  it("opens on the first step with настройка unfinished", () => {
    const setup = mockOrganizerSetup();

    expect(setup.step).toBe("venue");
    expect(setup.completedAt).toBeNull();
  });

  it("seeds the «Парк Горького» card макета from the place fixtures", () => {
    expect(mockOrganizerSetup().venue).toMatchObject({ title: "Парк Горького", address: "Крымский Вал, 9", city: "Москва" });
  });

  it("starts with no payment link, because the product takes no money itself", () => {
    expect(mockOrganizerSetup().payouts.mode).toBe("none");
    expect(mockOrganizerSetup().payouts.paymentUrl).toBeNull();
  });
});

describe("updateMockOrganizerSetup", () => {
  it("merges a patch without dropping the sections it leaves alone", () => {
    const updated = updateMockOrganizerSetup({ step: "payouts", activities: ["tours"] });

    expect(updated).not.toBe("invalid");
    if (updated === "invalid") return;
    expect(updated.step).toBe("payouts");
    expect(updated.activities).toEqual(["tours"]);
    expect(updated.venue.title).toBe("Парк Горького");
  });

  it("refuses an activity outside the five chips", () => {
    expect(updateMockOrganizerSetup({ activities: ["катание на слонах"] as never })).toBe("invalid");
  });

  it("refuses a paid mode whose link the Event contract would refuse too", () => {
    expect(updateMockOrganizerSetup({ payouts: { mode: "external", paymentUrl: "касса на входе" } })).toBe("invalid");
    expect(updateMockOrganizerSetup({ payouts: { mode: "external", paymentUrl: null } })).toBe("invalid");
  });

  it("takes a real link and keeps it", () => {
    const updated = updateMockOrganizerSetup({ payouts: { mode: "external", paymentUrl: "https://pay.example.com/gorky" } });

    expect(updated).not.toBe("invalid");
    if (updated === "invalid") return;
    expect(updated.payouts.paymentUrl).toBe("https://pay.example.com/gorky");
  });

  it("clears the link when the organizer goes back to free events", () => {
    updateMockOrganizerSetup({ payouts: { mode: "external", paymentUrl: "https://pay.example.com/gorky" } });
    const updated = updateMockOrganizerSetup({ payouts: { mode: "none" } });

    expect(updated).not.toBe("invalid");
    if (updated === "invalid") return;
    expect(updated.payouts.paymentUrl).toBeNull();
  });

  it("refuses a nameless venue rather than storing an empty card", () => {
    expect(updateMockOrganizerSetup({ venue: { title: "  " } })).toBe("invalid");
  });

  it("refuses a body that is not an object at all", () => {
    expect(updateMockOrganizerSetup(null)).toBe("invalid");
  });
});

describe("completeMockOrganizerSetup", () => {
  it("stamps completedAt, which is what «прошёл настройку» means", () => {
    const done = completeMockOrganizerSetup(new Date("2026-09-19T12:00:00.000Z"));

    expect(done.completedAt).toBe("2026-09-19T12:00:00.000Z");
    expect(mockOrganizerSetup().completedAt).toBe("2026-09-19T12:00:00.000Z");
  });

  it("is idempotent: a second visit does not move the stamp", () => {
    completeMockOrganizerSetup(new Date("2026-09-19T12:00:00.000Z"));

    expect(completeMockOrganizerSetup(new Date("2026-09-20T12:00:00.000Z")).completedAt).toBe("2026-09-19T12:00:00.000Z");
  });

  it("is undone by the reset, so «первый заход» can be replayed", () => {
    completeMockOrganizerSetup();
    resetMockOrganizerSetup();

    expect(mockOrganizerSetup().completedAt).toBeNull();
  });
});
