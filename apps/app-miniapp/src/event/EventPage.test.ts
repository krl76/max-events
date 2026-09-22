import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AutoPlanEntry, bookingErrorMessage, EventDetailsView, participationSummary, PARTICIPATION_STATUS_LABELS, ParticipationView, type PromoCodeState } from "./EventPage";
import { ApiError, type EventDetails, type ParticipationStats } from "../api/client";
import { mockEvents, mockOrganization, mockOrganizers, mockPlaces } from "../api/mock";
import type { Event, ParticipationStatus, Place } from "@max-events/api-contracts";

const paid = mockEvents[0];
const free = mockEvents.find((item) => item.priceRub === null && item.capacity !== null && item.placeId !== null)!;

function detailsFor(event: Event, overrides: Partial<EventDetails> = {}): EventDetails {
  const place: Place | null = mockPlaces.find((item) => item.id === event.placeId) ?? null;
  return {
    event,
    place,
    organizer: mockOrganizers[0],
    organization: mockOrganization,
    remainingSeats: event.capacity,
    activeBookingId: null,
    checkInId: null,
    ...overrides,
  };
}

describe("EventDetailsView", () => {
  it("renders every event field from the fixture", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {}, onOpenPlace: () => {}, onOpenChat: () => {} }));

    expect(html).toContain(free.title);
    expect(html).toContain(free.description.slice(0, 20));
    expect(html).toContain(new Date(free.startsAt).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }));
    expect(html).toContain("Парк Горького");
    expect(html).toContain("Крымский Вал, 9");
    expect(html).toContain("Волонтёрство");
    expect(html).toContain("Бесплатно");
    // The organizer row names the organization; "Анна Соколова" is only its account.
    expect(html).toContain(mockOrganization.name);
    expect(html).toContain(`Осталось ${free.capacity}`);
  });

  it("renders the city instead of an unknown place", () => {
    const withoutPlace = { ...free, placeId: null };
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(withoutPlace, { place: null }), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {}, onOpenPlace: () => {}, onOpenChat: () => {} }));

    expect(html).toContain(free.city);
  });

  it("renders the forecast row when weather is present and hides it otherwise", () => {
    const without = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor({ ...free, weather: null }), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {}, onOpenPlace: () => {}, onOpenChat: () => {} }));
    expect(without).not.toContain("дождь");

    const withWeather = { ...free, weather: { temperatureC: 12.4, condition: "облачно", conditionCode: 2, precipitationProbability: 40 } };
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(withWeather), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {}, onOpenPlace: () => {}, onOpenChat: () => {} }));
    expect(html).toContain("Погода");
    expect(html).toContain("+12°, облачно · дождь 40%");
  });

  it("renders a paid event price", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(paid), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {}, onOpenPlace: () => {}, onOpenChat: () => {} }));

    expect(html).toContain(`${paid.priceRub} ₽`);
  });

  it("shows the organizer fallback when neither an organization nor an organizer is known", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free, { organizer: null, organization: null }), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {}, onOpenPlace: () => {}, onOpenChat: () => {} }));

    expect(html).toContain("Организатор не указан");
    expect(html).not.toContain("Анна Соколова");
  });

  it("names the organization rather than the account behind it", () => {
    // The visitor deals with the organization; the organizer user row is an account, not a brand.
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {}, onOpenPlace: () => {}, onOpenChat: () => {} }));

    expect(html).toContain(mockOrganization.name);
    expect(html).toContain(mockOrganization.contacts!);
    expect(html).not.toContain("Организатор не указан");
  });

  it("falls back to the organizer name while an event has no organization", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free, { organization: null }), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {}, onOpenPlace: () => {}, onOpenChat: () => {} }));

    expect(html).toContain("Анна Соколова");
    expect(html).not.toContain("Связаться");
  });
});

describe("booking button states", () => {
  it("offers booking when seats are available", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {}, onOpenPlace: () => {}, onOpenChat: () => {} }));

    expect(html).toContain("Записаться");
    expect(html).not.toContain("Вы записаны");
    expect(html).not.toContain("disabled");
  });

  it("shows the booked state that cancels", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free, { activeBookingId: "e0000000-0000-4000-8000-000000000001" }), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {}, onOpenPlace: () => {}, onOpenChat: () => {} }));

    expect(html).toContain("Вы записаны");
    expect(html).not.toContain("Записаться");
  });

  it("disables booking when no seats remain", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free, { remainingSeats: 0 }), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {}, onOpenPlace: () => {}, onOpenChat: () => {} }));

    expect(html).toContain("Мест нет");
    expect(html).toContain("disabled");
    expect(html).not.toContain("Записаться");
  });

  it("shows Open chat only when chatLink is set", () => {
    const without = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {}, onOpenPlace: () => {}, onOpenChat: () => {} }));
    expect(without).not.toContain("Открыть чат");
    const withChat = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor({ ...free, chatLink: "https://max.ru/join/abc" }), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {}, onOpenPlace: () => {}, onOpenChat: () => {} }));
    expect(withChat).toContain("Открыть чат");
  });
});

describe("check-in button states", () => {
  it("offers the check-in before visiting", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {}, onOpenPlace: () => {}, onOpenChat: () => {} }));

    expect(html).toContain("Я здесь");
    expect(html).not.toContain("Вы были здесь");
  });

  it("shows the visited state and disables the button after a check-in", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free, { checkInId: "60000000-0000-4000-8000-000000000001" }), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {}, onOpenPlace: () => {}, onOpenChat: () => {} }));

    expect(html).toContain("Вы были здесь");
    expect(html).toContain("disabled");
    expect(html).not.toContain("Я здесь");
  });
});

describe("promo code field, booking errors and promoted badge", () => {
  const promo = (overrides: Partial<PromoCodeState> = {}): PromoCodeState => ({ code: "", referral: "", error: null, onCode: () => {}, onReferral: () => {}, ...overrides });
  const baseProps = { onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {}, onOpenPlace: () => {}, onOpenChat: () => {} };

  it("renders the promo code input while the event is bookable", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free), ...baseProps, promo: promo() }));

    expect(html).toContain('aria-label="Промокод"');
  });

  it("renders the referral code input next to the promo code (#372)", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free), ...baseProps, promo: promo({ referral: "FRIEND10" }) }));

    expect(html).toContain('aria-label="Код акции или друга"');
    expect(html).toContain('value="FRIEND10"');
  });

  it("hides the promo code input in the booked and sold-out states", () => {
    const booked = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free, { activeBookingId: "e0000000-0000-4000-8000-000000000001" }), ...baseProps, promo: promo() }));
    const soldOut = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free, { remainingSeats: 0 }), ...baseProps, promo: promo() }));

    expect(booked).not.toContain('aria-label="Промокод"');
    expect(soldOut).not.toContain('aria-label="Промокод"');
    expect(booked).not.toContain('aria-label="Код акции или друга"');
    expect(soldOut).not.toContain('aria-label="Код акции или друга"');
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
  const promo: PromoCodeState = { code: "", referral: "", error: null, onCode: () => {}, onReferral: () => {} };
  const baseProps = { onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {}, onOpenPlace: () => {}, onOpenChat: () => {}, promo };

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
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(paid), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {}, onOpenPlace: () => {}, onOpenChat: () => {} }));

    expect(html).toContain("Купить билет");
  });

  it("does not render the buy button for a free event", () => {
    const html = renderToStaticMarkup(createElement(EventDetailsView, { details: detailsFor(free), onBook: () => {}, onCancel: () => {}, onCheckIn: () => {}, onBuy: () => {}, onOpenPlace: () => {}, onOpenChat: () => {} }));

    expect(html).not.toContain("Купить билет");
  });
});

const ZERO_COUNTS: Record<ParticipationStatus, number> = { wants_to_go: 0, probably_going: 0, going: 0, looking_for_company: 0, looking_for_travel_buddy: 0, looking_for_after_event_company: 0 };
function statsFor(overrides: Partial<ParticipationStats> = {}): ParticipationStats {
  return { counts: { ...ZERO_COUNTS }, friendsCount: 0, myStatus: null, ...overrides };
}

describe("participationSummary", () => {
  const stats = (counts: Partial<Record<keyof typeof ZERO_COUNTS, number>>, friendsCount: number) => statsFor({ counts: { ...ZERO_COUNTS, ...counts }, friendsCount });

  it("declines each noun for its own number", () => {
    expect(participationSummary(stats({ going: 1, looking_for_company: 1 }, 1))).toBe("1 идёт · 1 знакомый отметился · 1 ищет компанию");
    expect(participationSummary(stats({ going: 2, looking_for_company: 3 }, 4))).toBe("2 идут · 4 знакомых отметились · 3 ищут компанию");
    expect(participationSummary(stats({ going: 5, looking_for_company: 11 }, 25))).toBe("5 идут · 25 знакомых отметились · 11 ищут компанию");
    // 21 is the trap: «21 идёт», not «21 идут».
    expect(participationSummary(stats({ going: 21, looking_for_company: 21 }, 21))).toBe("21 идёт · 21 знакомый отметился · 21 ищет компанию");
  });

  it("counts only «ищут компанию», not every looking-for status", () => {
    // A travel buddy and an after-event companion are different asks; folding them in would misreport.
    expect(participationSummary(stats({ going: 9, looking_for_travel_buddy: 3, looking_for_after_event_company: 2 }, 7))).toBe("9 идут · 7 знакомых отметились · 0 ищут компанию");
  });
});

describe("ParticipationView", () => {
  const props = { onSet: () => {}, onClear: () => {} };

  it("renders the status select with all six options plus the clearing empty option", () => {
    const html = renderToStaticMarkup(createElement(ParticipationView, { stats: statsFor({ myStatus: "going" }), ...props }));

    expect(html).toContain('aria-label="Твой статус участия"');
    expect(html).toContain("Не выбран");
    for (const label of Object.values(PARTICIPATION_STATUS_LABELS)) {
      expect(html).toContain(label);
    }
  });

  it("drops the counter list entirely when the summary already said everything", () => {
    // The list carries a top border and padding, so rendering it empty left a divider over nothing.
    const html = renderToStaticMarkup(createElement(ParticipationView, { stats: statsFor({ counts: { ...ZERO_COUNTS, going: 3, looking_for_company: 2 }, friendsCount: 1 }), ...props }));

    expect(html).toContain("3 идут");
    expect(html).not.toContain("app-participation-counters");
  });

  it("lists the non-zero statuses the summary does not already name", () => {
    const html = renderToStaticMarkup(createElement(ParticipationView, { stats: statsFor({ counts: { ...ZERO_COUNTS, looking_for_company: 4, going: 2, wants_to_go: 5 }, friendsCount: 7 }), ...props }));

    expect(html).toContain("Хотят пойти: 5");
    // "Идут: 2" under "2 идут" is the same fact twice.
    expect(html).not.toContain("Идут: 2");
    expect(html).not.toContain("Ищут компанию: 4");
    expect(html).not.toContain("Ищут попутчика:");
  });

  it("puts the matchmaking line on the event, including the zeros", () => {
    const peopled = renderToStaticMarkup(createElement(ParticipationView, { stats: statsFor({ counts: { ...ZERO_COUNTS, looking_for_company: 4, going: 2 }, friendsCount: 7 }), ...props }));
    expect(peopled).toContain("2 идут · 7 знакомых отметились · 4 ищут компанию");

    // "0 друзей" is what the friend graph actually says; hiding it read as "we have no idea".
    const alone = renderToStaticMarkup(createElement(ParticipationView, { stats: statsFor({ counts: { ...ZERO_COUNTS, going: 3 }, friendsCount: 0 }), ...props }));
    expect(alone).toContain("3 идут · 0 знакомых отметились · 0 ищут компанию");
  });

  it("hides the zero counter rows but still answers the question on an empty event", () => {
    const html = renderToStaticMarkup(createElement(ParticipationView, { stats: statsFor(), ...props }));

    expect(html).not.toContain("Ищут компанию:");
    expect(html).toContain("0 идут · 0 знакомых отметились · 0 ищут компанию");
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
