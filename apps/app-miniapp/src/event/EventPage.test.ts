import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EventDetailsView, PARTICIPATION_STATUS_LABELS, ParticipationView } from "./EventPage";
import type { EventDetails, ParticipationStats } from "../api/client";
import { mockEvents, mockOrganizers, mockPlaces } from "../api/mock";
import type { Event, ParticipationStatus, Place } from "@max-events/api-contracts";

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
    checkInId: null,
    ...overrides,
  };
}

describe("EventDetailsView", () => {
  it("renders every event field from the fixture", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {} }));

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
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(withoutPlace, { place: null }), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {} }));

    expect(html).toContain(free.city);
  });

  it("renders a paid event price", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(paid), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {} }));

    expect(html).toContain(`${paid.priceRub} ₽`);
  });
});

describe("booking button states", () => {
  it("offers booking when seats are available", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {} }));

    expect(html).toContain("Записаться");
    expect(html).not.toContain("Вы записаны");
    expect(html).not.toContain("disabled");
  });

  it("shows the booked state that cancels", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free, { activeBookingId: "e0000000-0000-4000-8000-000000000001" }), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {} }));

    expect(html).toContain("Вы записаны");
    expect(html).not.toContain("Записаться");
  });

  it("disables booking when no seats remain", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free, { remainingSeats: 0 }), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {} }));

    expect(html).toContain("Мест нет");
    expect(html).toContain("disabled");
    expect(html).not.toContain("Записаться");
  });
});

describe("check-in button states", () => {
  it("offers the check-in before visiting", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {} }));

    expect(html).toContain("Я здесь");
    expect(html).not.toContain("Вы были здесь");
  });

  it("shows the visited state and disables the button after a check-in", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free, { checkInId: "60000000-0000-4000-8000-000000000001" }), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {} }));

    expect(html).toContain("Вы были здесь");
    expect(html).toContain("disabled");
    expect(html).not.toContain("Я здесь");
  });
});

describe("payment link button", () => {
  it("renders the buy button for a paid event with a payment url", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(paid), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {} }));

    expect(html).toContain("Купить билет");
  });

  it("does not render the buy button for a free event", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {} }));

    expect(html).not.toContain("Купить билет");
  });
});

const ZERO_COUNTS: Record<ParticipationStatus, number> = { wants_to_go: 0, probably_going: 0, going: 0, looking_for_company: 0, looking_for_travel_buddy: 0, looking_for_after_event_company: 0 };

function statsFor(overrides: Partial<ParticipationStats> = {}): ParticipationStats {
  return { counts: { ...ZERO_COUNTS }, friendsCount: 0, myStatus: null, ...overrides };
}

describe("ParticipationView", () => {
  const props = { onSet: () => {}, onClear: () => {} };

  it("renders all six status chips with the contract labels", () => {
    const html = renderToStaticMarkup(createElement(ParticipationView, { stats: statsFor(), ...props }));

    for (const label of Object.values(PARTICIPATION_STATUS_LABELS)) {
      expect(html).toContain(label);
    }
  });

  it("marks exactly the chosen status and offers clearing it", () => {
    const html = renderToStaticMarkup(createElement(ParticipationView, { stats: statsFor({ myStatus: "going" }), ...props }));

    expect(html).toContain('aria-pressed="true"');
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toContain("Снять статус");
  });

  it("hides the selection and the clear button without my status", () => {
    const html = renderToStaticMarkup(createElement(ParticipationView, { stats: statsFor(), ...props }));

    expect(html).not.toContain('aria-pressed="true"');
    expect(html).not.toContain("Снять статус");
  });

  it("renders only non-zero status counters and the friends line", () => {
    const html = renderToStaticMarkup(createElement(ParticipationView, { stats: statsFor({ counts: { ...ZERO_COUNTS, looking_for_company: 4, going: 2 }, friendsCount: 7 }), ...props }));

    expect(html).toContain("Идут: 2");
    expect(html).toContain("Ищут компанию: 4");
    expect(html).toContain("Твои знакомые: 7");
    expect(html).not.toContain("Хотят пойти:");
    expect(html).not.toContain("Ищут попутчика:");
  });

  it("hides zero counters and the friends line on an empty event", () => {
    const html = renderToStaticMarkup(createElement(ParticipationView, { stats: statsFor(), ...props }));

    expect(html).not.toContain("Ищут компанию:");
    expect(html).not.toContain("Твои знакомые");
  });
});
