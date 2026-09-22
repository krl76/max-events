import { describe, expect, it } from "vitest";
import { formatWaitlistOfferText, OFFER_TTL_MS } from "./waitlist.service";

const offeredAt = new Date("2026-09-12T16:30:00Z");

describe("formatWaitlistOfferText", () => {
  it("names the event and the Moscow deadline, not a raw timestamp", () => {
    const text = formatWaitlistOfferText("Джаз в парке", new Date(offeredAt.getTime() + OFFER_TTL_MS));
    expect(text).toContain("«Джаз в парке»");
    expect(text).toContain("Подтверди до 19:45 МСК");
    expect(text).not.toContain("T16:");
    expect(text).not.toContain("Z");
  });

  it("says what happens after the deadline, so the timer means something", () => {
    expect(formatWaitlistOfferText("Джаз", new Date(offeredAt.getTime() + OFFER_TTL_MS))).toContain("следующему в очереди");
  });

  it("states the deadline alone, never a countdown that a delayed DM would falsify", () => {
    const text = formatWaitlistOfferText("Джаз", new Date(offeredAt.getTime() + OFFER_TTL_MS));
    expect(text).not.toContain("осталось");
    expect(text).not.toMatch(/\d+ мин/);
  });

  it("keeps the deadline readable when the window crosses Moscow midnight", () => {
    expect(formatWaitlistOfferText("Джаз", new Date("2026-09-12T21:05:00Z"))).toContain("Подтверди до 00:05 МСК");
  });
});
