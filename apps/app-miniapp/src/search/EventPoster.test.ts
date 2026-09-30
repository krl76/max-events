import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mockEvents } from "../api/mock";
import type { CatalogCard } from "../api/client";
import { EventPoster, posterHighlight } from "./EventPoster";

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

describe("EventPoster", () => {
  it("keeps the Pushkin Card off the mini-card", () => {
    const paidAfisha = mockEvents.find((item) => item.category === "afisha" && item.isPaid)!;
    const html = renderToStaticMarkup(createElement(EventPoster, { card: card(paidAfisha), onOpen: () => {} }));

    expect(html).toContain(paidAfisha.title);
    expect(html).not.toContain("app-pushkin-badge");
    expect(html).not.toContain("Пушкинская");
  });
});
