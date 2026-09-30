import { describe, expect, it } from "vitest";
import { mockEvents } from "../api/mock";
import type { CatalogCard } from "../api/client";
import { posterHighlight } from "./EventPoster";

function card(event: CatalogCard["event"]): CatalogCard {
  return { event, distanceKm: 1.2, rating: null, placeTitle: "Парк" };
}

describe("posterHighlight", () => {
  it("keeps seats off the mini-card", () => {
    const paid = mockEvents.find((item) => item.isPaid && item.capacity != null && item.priceRub != null)!;
    const free = mockEvents.find((item) => !item.isPaid && item.capacity != null)!;

    expect(posterHighlight(card({ ...paid, bookedCount: 12 }))).toBe(`${paid.priceRub} ₽`);
    expect(posterHighlight(card({ ...paid, bookedCount: 12 }))).not.toMatch(/мест/);
    expect(posterHighlight(card({ ...free, bookedCount: 4 }))).toBe("Вход свободный");
    expect(posterHighlight(card({ ...free, bookedCount: 4 }))).not.toMatch(/мест/);
  });
});
