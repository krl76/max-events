import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EventDetailsView } from "./EventPage";
import type { EventDetails } from "../api/client";
import { mockEvents, mockOrganizers, mockPlaces } from "../api/mock";
import type { Event, Place } from "@max-events/api-contracts";

const paid = mockEvents[0];
const free = mockEvents.find((item) => item.priceRub === null && item.capacity !== null && item.placeId !== null)!;

function detailsFor(event: Event, overrides: Partial<EventDetails> = {}): EventDetails {
  const place: Place | null = mockPlaces.find((item) => item.id === event.placeId) ?? null;
  return {
    event,
    place,
    organizer: mockOrganizers[0],
    remainingSeats: event.capacity,
    activeBookingId: null,
    ...overrides,
  };
}

describe("EventDetailsView", () => {
  it("renders every event field from the fixture", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free), onBook: () => {}, onCancel: () => {}, onBuy: () => {} }));

    expect(html).toContain(free.title);
    expect(html).toContain(free.description.slice(0, 20));
    expect(html).toContain(new Date(free.startsAt).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }));
    expect(html).toContain("Парк Горького");
    expect(html).toContain("Крымский Вал, 9");
    expect(html).toContain("Волонтёрство");
    expect(html).toContain("Бесплатно");
    expect(html).toContain("Анна Соколова");
    expect(html).toContain(`Осталось ${free.capacity}`);
  });

  it("renders the city instead of an unknown place", () => {
    const withoutPlace = { ...free, placeId: null };
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(withoutPlace, { place: null }), onBook: () => {}, onCancel: () => {}, onBuy: () => {} }));

    expect(html).toContain(free.city);
  });

  it("renders a paid event price", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(paid), onBook: () => {}, onCancel: () => {}, onBuy: () => {} }));

    expect(html).toContain(`${paid.priceRub} ₽`);
  });
});

describe("booking button states", () => {
  it("offers booking when seats are available", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free), onBook: () => {}, onCancel: () => {}, onBuy: () => {} }));

    expect(html).toContain("Записаться");
    expect(html).not.toContain("Вы записаны");
    expect(html).not.toContain("disabled");
  });

  it("shows the booked state that cancels", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free, { activeBookingId: "e0000000-0000-4000-8000-000000000001" }), onBook: () => {}, onCancel: () => {}, onBuy: () => {} }));

    expect(html).toContain("Вы записаны");
    expect(html).not.toContain("Записаться");
  });

  it("disables booking when no seats remain", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free, { remainingSeats: 0 }), onBook: () => {}, onCancel: () => {}, onBuy: () => {} }));

    expect(html).toContain("Мест нет");
    expect(html).toContain("disabled");
    expect(html).not.toContain("Записаться");
  });
});

describe("payment link button", () => {
  it("renders the buy button for a paid event with a payment url", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(paid), onBook: () => {}, onCancel: () => {}, onBuy: () => {} }));

    expect(html).toContain("Купить билет");
  });

  it("does not render the buy button for a free event", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free), onBook: () => {}, onCancel: () => {}, onBuy: () => {} }));

    expect(html).not.toContain("Купить билет");
  });
});
