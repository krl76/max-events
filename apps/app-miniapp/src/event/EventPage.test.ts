import { describe, expect, it } from "vitest";
import { ApiError } from "../api/client";
import type { EventDetails, TravelOption } from "../api/client";
import { mockEvents, mockPlaces } from "../api/mock";
import { bookingErrorMessage, eventShareText, fastestTravelOption, organizerDisplayName, PARTICIPATION_STATUS_LABELS, walkingOption } from "./EventPage";

// Локальное время без смещения: «14:00» обязано читаться одинаково в любой зоне прогона.
const STARTS_AT = "2026-09-19T14:00:00";
const ENDS_AT = "2026-09-19T18:00:00";

const detailsOf = (over: Partial<EventDetails> = {}): EventDetails => ({
  event: { ...mockEvents[0], title: "Мангальная зона", startsAt: STARTS_AT, endsAt: ENDS_AT },
  place: mockPlaces[0],
  organizer: null,
  organization: null,
  remainingSeats: 4,
  activeBookingId: null,
  checkInId: null,
  organizerEventsCount: 34,
  ...over,
});

describe("bookingErrorMessage", () => {
  it("blames the code when one was typed and asks for one when it was not", () => {
    const forbidden = new ApiError(403, "forbidden");

    expect(bookingErrorMessage(forbidden, true)).toContain("Промокод не подошёл");
    expect(bookingErrorMessage(forbidden, false)).toContain("промокоду раннего доступа");
  });

  it("reports a sold-out event on 409 and falls back to a retry otherwise", () => {
    expect(bookingErrorMessage(new ApiError(409, "conflict"), false)).toBe("К сожалению, места закончились.");
    expect(bookingErrorMessage(new Error("network"), false)).toBe("Не удалось записаться. Попробуйте ещё раз.");
  });
});

describe("eventShareText", () => {
  it("shares the title with the day and the time window", () => {
    const text = eventShareText({ title: "Мангальная зона", startsAt: STARTS_AT, endsAt: ENDS_AT });

    expect(text).toContain("Мангальная зона");
    expect(text).toContain("19 сентября");
    expect(text).toContain("14:00 – 18:00");
  });
});

describe("organizerDisplayName", () => {
  it("prefers the organization the visitor is dealing with over the account behind it", () => {
    const withOrg = organizerDisplayName(detailsOf({ organization: { id: "e0000000-0000-4000-8000-000000000001", name: "Парк Горького", contacts: null, activities: [] } }));

    expect(withOrg).toBe("Парк Горького");
  });

  it("falls back to the organizer name and then to a placeholder", () => {
    const person = { id: "d0000001-0000-4000-8000-000000000001", maxUserId: "o1", firstName: "Анна", lastName: "Соколова", username: null, avatarUrl: null, createdAt: STARTS_AT, updatedAt: STARTS_AT };

    expect(organizerDisplayName(detailsOf({ organizer: person }))).toBe("Анна Соколова");
    expect(organizerDisplayName(detailsOf())).toBe("Организатор не указан");
  });
});

describe("walkingOption", () => {
  it("picks the walking estimate and ignores the metro one", () => {
    const options: TravelOption[] = [
      { mode: "metro", minutes: 9, distanceKm: 2.1, transfers: 1 },
      { mode: "walk", minutes: 18, distanceKm: 2.1, transfers: null },
    ];

    expect(walkingOption(options)).toEqual({ mode: "walk", minutes: 18, distanceKm: 2.1, transfers: null });
    expect(walkingOption([options[0]])).toBeNull();
  });
});

describe("fastestTravelOption", () => {
  it("picks the shortest tile so the event card prefers the road or metro over a long walk", () => {
    const options: TravelOption[] = [
      { mode: "walk", minutes: 28, distanceKm: 2.1, transfers: null },
      { mode: "metro", minutes: 14, distanceKm: 2.1, transfers: 1 },
      { mode: "car", minutes: 9, distanceKm: 2.1, transfers: null },
    ];

    expect(fastestTravelOption(options)?.mode).toBe("car");
    expect(fastestTravelOption(options.slice(0, 2))?.mode).toBe("metro");
    expect(fastestTravelOption([])).toBeNull();
  });
});

describe("PARTICIPATION_STATUS_LABELS", () => {
  it("names all six statuses, so the friends feed and экран 23 read the same words", () => {
    expect(Object.keys(PARTICIPATION_STATUS_LABELS)).toHaveLength(6);
    expect(PARTICIPATION_STATUS_LABELS.looking_for_company).toBe("Ищу компанию");
  });
});
