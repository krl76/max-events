import { describe, expect, it } from "vitest";
import type { OrganizerEvent, OrganizerEventOptions } from "../api/client";
import { EMPTY_ORGANIZER_EVENT_FORM, formatFormTime, organizerEventFormErrors, organizerEventFormFrom, organizerEventFormOptions, organizerEventFormToCreate, weeklySeriesNote, weeklySeriesUntil, type OrganizerEventFormDraft } from "./OrganizerEventForm";

const ready: OrganizerEventFormDraft = { ...EMPTY_ORGANIZER_EVENT_FORM, title: "Йога на набережной", city: "Москва", date: "2026-09-20", startTime: "09:00", endTime: "10:30", capacity: "40" };

describe("organizerEventFormErrors", () => {
  it("passes a draft that has everything публикация needs", () => {
    expect(organizerEventFormErrors(ready)).toEqual([]);
  });

  it("names every missing field of an empty draft instead of stopping at the first", () => {
    const errors = organizerEventFormErrors(EMPTY_ORGANIZER_EVENT_FORM);

    expect(errors).toContain("Укажите название события");
    expect(errors).toContain("Укажите город");
    expect(errors).toContain("Укажите дату");
    expect(errors).toContain("Укажите время начала");
  });

  it("keeps the contract invariant: a paid event needs a payment link", () => {
    expect(organizerEventFormErrors({ ...ready, price: "500" })).toContain("Для платного события нужна ссылка на оплату");
    expect(organizerEventFormErrors({ ...ready, price: "500", paymentUrl: "https://tickets.example.com/yoga" })).toEqual([]);
  });

  it("refuses an end before the start and a waitlist without a seat limit", () => {
    expect(organizerEventFormErrors({ ...ready, endTime: "08:00" })).toContain("Окончание не может быть раньше начала");
    expect(organizerEventFormErrors({ ...ready, capacity: "" })).toContain("Лист ожидания нужен только там, где есть предел мест");
  });

  it("requires the link when registration leaves the mini-app", () => {
    expect(organizerEventFormErrors({ ...ready, registrationInApp: false })).toContain("Укажите ссылку на регистрацию на вашем сайте");
    expect(organizerEventFormErrors({ ...ready, registrationInApp: false, externalUrl: "https://park.example.com" })).toEqual([]);
  });
});

describe("organizerEventFormToCreate", () => {
  it("builds a free event with no payment link and the seats it was given", () => {
    const payload = organizerEventFormToCreate(ready);

    expect(payload).toMatchObject({ title: "Йога на набережной", city: "Москва", isPaid: false, priceRub: null, paymentUrl: null, capacity: 40, placeId: null });
    expect(new Date(payload.startsAt).getHours()).toBe(9);
    expect(payload.endsAt).not.toBeNull();
  });

  it("marks a priced event as paid and carries its link", () => {
    expect(organizerEventFormToCreate({ ...ready, price: "500", paymentUrl: " https://tickets.example.com/yoga " })).toMatchObject({ isPaid: true, priceRub: 500, paymentUrl: "https://tickets.example.com/yoga" });
  });
});

describe("organizerEventFormOptions", () => {
  it("drops the external link while registration stays in the mini-app", () => {
    expect(organizerEventFormOptions(ready)).toEqual({ waitlistEnabled: true, registrationInApp: true, externalUrl: null, recurrence: null });
  });

  it("turns the weekly switch into a rule with the horizon the screen promised", () => {
    expect(organizerEventFormOptions({ ...ready, repeatWeekly: true })).toMatchObject({ recurrence: { rule: "weekly", until: "2026-10-31" } });
  });
});

describe("weeklySeriesUntil", () => {
  it("runs to the last day of the month after the first date, over a year boundary too", () => {
    expect(weeklySeriesUntil("2026-09-20")).toBe("2026-10-31");
    expect(weeklySeriesUntil("2026-12-05")).toBe("2027-01-31");
    expect(weeklySeriesUntil("")).toBe("");
  });

  it("says what to do first when there is no date yet", () => {
    expect(weeklySeriesNote("")).toBe("Сначала выберите дату");
    expect(weeklySeriesNote("2026-09-20")).toContain("октября");
  });
});

describe("formatFormTime", () => {
  it("shows one time without an end and a range with one", () => {
    expect(formatFormTime("09:00", "")).toBe("09:00");
    expect(formatFormTime("09:00", "10:30")).toBe("09:00 – 10:30");
    expect(formatFormTime("", "")).toBe("Не выбрано");
  });
});

describe("organizerEventFormFrom", () => {
  const event: OrganizerEvent = {
    id: "c00000f1-0000-4000-8000-0000000000f1",
    coverUrl: null,
    title: "Квиз «Мозгобойня»",
    description: "Командная игра",
    category: "afisha",
    city: "Москва",
    placeId: null,
    startsAt: "2026-09-06T19:00:00+03:00",
    endsAt: null,
    isPaid: true,
    priceRub: 500,
    paymentUrl: "https://tickets.example.com/quiz",
    capacity: 60,
    chatLink: null,
    promoted: false,
    published: true,
    bookingOpensAt: null,
    weather: null,
    draft: false,
  };

  it("round-trips an existing event back into the fields the form edits", () => {
    const options: OrganizerEventOptions = { eventId: event.id, waitlistEnabled: false, registrationInApp: false, externalUrl: "https://quiz.example.com", recurrence: { rule: "weekly", until: "2026-10-31" } };
    const draft = organizerEventFormFrom(event, options);

    expect(draft).toMatchObject({ title: event.title, city: "Москва", capacity: "60", price: "500", waitlistEnabled: false, registrationInApp: false, externalUrl: "https://quiz.example.com", repeatWeekly: true });
    expect(organizerEventFormErrors(draft)).toEqual([]);
  });

  it("falls back to what the event itself says when the options sub-resource is unavailable", () => {
    expect(organizerEventFormFrom(event, null)).toMatchObject({ waitlistEnabled: true, registrationInApp: true, repeatWeekly: false });
  });
});
