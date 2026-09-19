import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AutoPlanEntry, bookingErrorMessage, EventDetailsView, PARTICIPATION_STATUS_LABELS, ParticipationView, type PromoCodeState } from "./EventPage";
import { ApiError, type EventDetails, type ParticipationStats } from "../api/client";
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
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {}, onOpenPlace: () => {} }));

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
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(withoutPlace, { place: null }), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {}, onOpenPlace: () => {} }));

    expect(html).toContain(free.city);
  });

  it("renders a paid event price", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(paid), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {}, onOpenPlace: () => {} }));

    expect(html).toContain(`${paid.priceRub} ₽`);
  });

  it("shows the organizer fallback when organizer is null", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free, { organizer: null }), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {}, onOpenPlace: () => {} }));

    expect(html).toContain("Организатор не указан");
    expect(html).not.toContain("Анна Соколова");
  });
});

describe("booking button states", () => {
  it("offers booking when seats are available", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {}, onOpenPlace: () => {} }));

    expect(html).toContain("Записаться");
    expect(html).not.toContain("Вы записаны");
    expect(html).not.toContain("disabled");
  });

  it("shows the booked state that cancels", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free, { activeBookingId: "e0000000-0000-4000-8000-000000000001" }), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {}, onOpenPlace: () => {} }));

    expect(html).toContain("Вы записаны");
    expect(html).not.toContain("Записаться");
  });

  it("disables booking when no seats remain", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free, { remainingSeats: 0 }), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {}, onOpenPlace: () => {} }));

    expect(html).toContain("Мест нет");
    expect(html).toContain("disabled");
    expect(html).not.toContain("Записаться");
  });
});

describe("check-in button states", () => {
  it("offers the check-in before visiting", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {}, onOpenPlace: () => {} }));

    expect(html).toContain("Я здесь");
    expect(html).not.toContain("Вы были здесь");
  });

  it("shows the visited state and disables the button after a check-in", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free, { checkInId: "60000000-0000-4000-8000-000000000001" }), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {}, onOpenPlace: () => {} }));

    expect(html).toContain("Вы были здесь");
    expect(html).toContain("disabled");
    expect(html).not.toContain("Я здесь");
  });
});

describe("promo code field, booking errors and promoted badge", () => {
  const promo = (overrides: Partial<PromoCodeState> = {}): PromoCodeState => ({ code: "", error: null, onCode: () => {}, ...overrides });
  const baseProps = { onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {}, onOpenPlace: () => {} };

  it("renders the promo code input while the event is bookable", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free), ...baseProps, promo: promo() }));

    expect(html).toContain('aria-label="Промокод"');
  });

  it("hides the promo code input in the booked and sold-out states", () => {
    const booked = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free, { activeBookingId: "e0000000-0000-4000-8000-000000000001" }), ...baseProps, promo: promo() }));
    const soldOut = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free, { remainingSeats: 0 }), ...baseProps, promo: promo() }));

    expect(booked).not.toContain('aria-label="Промокод"');
    expect(soldOut).not.toContain('aria-label="Промокод"');
  });

  it("shows the booking error inline instead of an alert", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free), ...baseProps, promo: promo({ code: "NOPE", error: "Промокод не подошёл — проверьте код и срок его действия." }) }));

    expect(html).toContain("app-state--error");
    expect(html).toContain("Промокод не подошёл");
  });

  it("renders the «Промо» badge only for promoted events", () => {
    const promoted = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor({ ...free, promoted: true }), ...baseProps }));
    const regular = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free), ...baseProps }));

    expect(promoted).toContain("Промо");
    expect(regular).not.toContain("Промо");
  });
  it("maps booking failures to inline messages", () => {
    expect(bookingErrorMessage(new ApiError(403, "forbidden"), false)).toContain("раннего доступа");
    expect(bookingErrorMessage(new ApiError(403, "forbidden"), true)).toContain("Промокод не подошёл");
    expect(bookingErrorMessage(new ApiError(409, "conflict"), false)).toContain("места закончились");
    expect(bookingErrorMessage(new Error("network"), false)).toContain("Не удалось записаться");
  });
});

describe("early-access bookingOpensAt line", () => {
  const promo: PromoCodeState = { code: "", error: null, onCode: () => {} };
  const baseProps = { onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {}, onOpenPlace: () => {}, promo };

  it("shows when booking opens while the window is in the future", () => {
    const opensAt = "2027-06-01T10:00:00+03:00";
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor({ ...free, bookingOpensAt: opensAt }), ...baseProps }));

    expect(html).toContain("Запись откроется");
    expect(html).toContain(new Date(opensAt).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }));
  });

  it("stays hidden once the window has opened or is absent", () => {
    const past = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor({ ...free, bookingOpensAt: "2020-01-01T10:00:00+03:00" }), ...baseProps }));
    const none = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free), ...baseProps }));

    expect(past).not.toContain("Запись откроется");
    expect(none).not.toContain("Запись откроется");
  });
});

describe("payment link button", () => {
  it("renders the buy button for a paid event with a payment url", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(paid), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {}, onOpenPlace: () => {} }));

    expect(html).toContain("Купить билет");
  });

  it("does not render the buy button for a free event", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {}, onOpenPlace: () => {} }));

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

describe("AutoPlanEntry", () => {
  it("offers «Собрать план» only in the booked state", () => {
    const booked = renderToStaticMarkup(createElement(AutoPlanEntry, { activeBookingId: "e0000000-0000-4000-8000-000000000001", eventId: paid.id }));
    expect(booked).toContain("Собрать план");

    const notBooked = renderToStaticMarkup(createElement(AutoPlanEntry, { activeBookingId: null, eventId: paid.id }));
    expect(notBooked).not.toContain("Собрать план");
  });
});
