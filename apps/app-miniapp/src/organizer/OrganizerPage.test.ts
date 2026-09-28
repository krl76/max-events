import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EMPTY_EVENT_DRAFT, EMPTY_PLACE_DRAFT, EventDraftForm, eventDraftErrors, eventDraftFrom, OrganizerEventCard, OrganizerListStatus, OrganizerPlaceCard, placeDraftErrors, splitOrganizerEvents, toCreateEvent, toEventPatch, toLocalInput, type EventDraft, type OrganizerListState } from "./OrganizerPage";
import type { OrganizerEvent, OrganizerPlace } from "../api/client";

const noop = () => {};

const draftEvent: OrganizerEvent = {
  id: "f1000000-0000-4000-8000-000000000001",
  title: "Акустический вечер",
  description: "",
  category: "afisha",
  city: "Москва",
  placeId: null,
  startsAt: "2026-10-11T19:00:00+03:00",
  endsAt: null,
  isPaid: false,
  priceRub: null,
  paymentUrl: null,
  capacity: 40,
  chatLink: null,
  promoted: false,
  draft: true,
  published: false,
  bookingOpensAt: null,
  weather: null,
  coverUrl: null,
};

const publishedPlace: OrganizerPlace = {
  id: "f2000000-0000-4000-8000-000000000001",
  title: "Лофт на Бауманской",
  address: "ул. Бауманская, 5",
  city: "Москва",
  category: "other",
  latitude: 55.7717,
  longitude: 37.6879,
  createdAt: "2026-08-01T12:00:00+03:00",
  updatedAt: "2026-08-01T12:00:00+03:00",
  draft: false,
  published: true,
  logoUrl: null,
};

const readyDraft: EventDraft = { title: "Встреча книжного клуба", description: "", category: "afisha", city: "Москва", startsAt: "2026-10-20T19:00", endsAt: "", price: "", paymentUrl: "", capacity: "12", address: "", latitude: "55.7558", longitude: "37.6173", pinned: false, placeId: "", waitlistEnabled: false, registrationInApp: true, externalUrl: "", repeatWeekly: false, sellOutside: false, summary: "", age: "", duration: "", categorySet: true };

describe("eventDraftErrors", () => {
  it("accepts a ready draft and reports every missing required field", () => {
    expect(eventDraftErrors(readyDraft)).toEqual([]);
    expect(eventDraftErrors(EMPTY_EVENT_DRAFT)).toEqual(["Укажите название события", "Укажите город", "Укажите дату и время начала"]);
  });

  it("rejects a negative price, a paid event without a payment link and a zero capacity", () => {
    expect(eventDraftErrors({ ...readyDraft, price: "-10" })).toContain("Цена — целое число от 0");
    expect(eventDraftErrors({ ...readyDraft, price: "500" })).toContain("Добавьте ссылку на покупку");
    expect(eventDraftErrors({ ...readyDraft, sellOutside: true, price: "" })).toContain("Укажите цену билета");
    expect(eventDraftErrors({ ...readyDraft, capacity: "0" })).toContain("Вместимость — целое число от 1");
  });

  it("rejects an endsAt that is before startsAt", () => {
    expect(eventDraftErrors({ ...readyDraft, startsAt: "2026-10-20T19:00", endsAt: "2026-10-20T09:00" })).toContain("Окончание не может быть раньше начала");
    expect(eventDraftErrors({ ...readyDraft, startsAt: "2026-10-20T19:00", endsAt: "2026-10-20T21:00" })).toEqual([]);
  });

  it("asks for a capacity when the waitlist is on and for a registration link when signup leaves the app", () => {
    expect(eventDraftErrors({ ...readyDraft, capacity: "", waitlistEnabled: true })).toContain("Лист ожидания нужен только там, где есть предел мест");
    expect(eventDraftErrors({ ...readyDraft, registrationInApp: false, externalUrl: "" })).toContain("Укажите ссылку на регистрацию на вашем сайте");
    expect(eventDraftErrors({ ...readyDraft, registrationInApp: false, externalUrl: "https://tickets.example.com" })).toEqual([]);
  });
});

describe("placeDraftErrors", () => {
  it("accepts the default coordinates and reports missing title/address/city", () => {
    expect(placeDraftErrors({ ...EMPTY_PLACE_DRAFT, title: "Лофт", address: "ул. Бауманская, 5", city: "Москва" })).toEqual([]);
    expect(placeDraftErrors(EMPTY_PLACE_DRAFT)).toEqual(["Укажите название места", "Укажите адрес", "Укажите город"]);
  });

  it("rejects out-of-range coordinates", () => {
    expect(placeDraftErrors({ ...EMPTY_PLACE_DRAFT, title: "Лофт", address: "ул. Бауманская, 5", city: "Москва", latitude: "100" })).toContain("Широта — число от -90 до 90");
    expect(placeDraftErrors({ ...EMPTY_PLACE_DRAFT, title: "Лофт", address: "ул. Бауманская, 5", city: "Москва", longitude: "abc" })).toContain("Долгота — число от -180 до 180");
  });
});

describe("toCreateEvent", () => {
  it("maps an empty price to a free event without a payment link", () => {
    const payload = toCreateEvent(readyDraft);
    expect(payload.isPaid).toBe(false);
    expect(payload.priceRub).toBeNull();
    expect(payload.paymentUrl).toBeNull();
    expect(payload.capacity).toBe(12);
    expect(payload.title).toBe("Встреча книжного клуба");
  });

  it("maps a positive price to a paid event with the payment link", () => {
    const payload = toCreateEvent({ ...readyDraft, price: "500", paymentUrl: "https://tickets.example.com/book" });
    expect(payload.isPaid).toBe(true);
    expect(payload.priceRub).toBe(500);
    expect(payload.paymentUrl).toBe("https://tickets.example.com/book");
  });
});

describe("toEventPatch / eventDraftFrom", () => {
  it("round-trips an item into the form and back into the minimal patch fields", () => {
    const draft = eventDraftFrom(draftEvent);
    expect(draft.title).toBe(draftEvent.title);
    expect(draft.capacity).toBe("40");
    // prefill keeps the same instant, expressed as a local datetime-local string (TZ-independent via Date.parse)
    expect(new Date(draft.startsAt).getTime()).toBe(new Date(draftEvent.startsAt).getTime());
    expect(draft.endsAt).toBe("");

    const patch = toEventPatch(draft);
    expect(patch.title).toBe(draftEvent.title);
    expect(patch.capacity).toBe(40);
    // save of an untouched form must preserve the original UTC instant (no TZ drift)
    expect(new Date(patch.startsAt as string).getTime()).toBe(new Date(draftEvent.startsAt).getTime());
    expect(patch.category).toBe("afisha");
    expect(patch.city).toBe("Москва");
    expect(patch.description).toBe("");
  });

  it("round-trips an endsAt through prefill and save without drift", () => {
    const item = { ...draftEvent, endsAt: "2026-10-12T10:00:00+03:00" };
    const draft = eventDraftFrom(item);
    const patch = toEventPatch(draft);
    expect(draft.endsAt).not.toBe("");
    expect(new Date(patch.endsAt as string).getTime()).toBe(new Date(item.endsAt as string).getTime());
  });
});

describe("toLocalInput", () => {
  it("formats an ISO instant into a local datetime-local value and back is stable via Date.parse", () => {
    const iso = "2026-10-11T19:00:00+03:00";
    const input = toLocalInput(iso);
    expect(input).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(new Date(input).getTime()).toBe(new Date(iso).getTime());
  });

  it("returns an empty string for an invalid date", () => {
    expect(toLocalInput("not-a-date")).toBe("");
  });
});

describe("splitOrganizerEvents", () => {
  it("keeps drafts apart from upcoming and past published events", () => {
    const past = { ...draftEvent, id: "f1000000-0000-4000-8000-000000000002", draft: false, startsAt: "2026-01-01T19:00:00+03:00", endsAt: null };
    const upcoming = { ...draftEvent, id: "f1000000-0000-4000-8000-000000000003", draft: false, startsAt: "2026-12-01T19:00:00+03:00", endsAt: null };
    const groups = splitOrganizerEvents([draftEvent, past, upcoming], new Date("2026-09-26T12:00:00+03:00").getTime());

    expect(groups.drafts.map((item) => item.id)).toEqual([draftEvent.id]);
    expect(groups.past.map((item) => item.id)).toEqual([past.id]);
    expect(groups.upcoming.map((item) => item.id)).toEqual([upcoming.id]);
  });
});

describe("OrganizerEventCard", () => {
  const card = (item: OrganizerEvent, failed = false) => renderToStaticMarkup(createElement(OrganizerEventCard, { item, publishing: false, failed, onPublish: noop, onEdit: noop }));

  it("shows the draft badge and the publish button on a draft", () => {
    const html = card(draftEvent);
    expect(html).toContain("Черновик");
    expect(html).not.toContain("Изменить");
    expect(html).toContain(draftEvent.title);
    expect(html).toContain("0 из 40 · свободно 40 мест");
  });

  it("shows the inline publish failure message without dropping the card", () => {
    const html = card(draftEvent, true);
    expect(html).toContain("Не удалось опубликовать");
    expect(html).toContain(draftEvent.title);
  });

  it("hides the badge and the publish button on a published event", () => {
    const html = card({ ...draftEvent, draft: false });
    expect(html).not.toContain("Черновик");
    expect(html).not.toContain("Опубликовать");
    expect(html).not.toContain("Изменить");
  });
});

describe("OrganizerPlaceCard", () => {
  it("shows the publish button only on drafts", () => {
    const published = renderToStaticMarkup(createElement(OrganizerPlaceCard, { item: publishedPlace, publishing: false, failed: false, onPublish: noop, onOpen: noop }));
    expect(published).not.toContain("Черновик");
    expect(published).not.toContain("Изменить");

    const draft = renderToStaticMarkup(createElement(OrganizerPlaceCard, { item: { ...publishedPlace, draft: true }, publishing: false, failed: false, onPublish: noop, onOpen: noop }));
    expect(draft).toContain("Черновик");
    expect(draft).not.toContain("Изменить");
    expect(draft).toContain(publishedPlace.address);
  });
});

describe("EventDraftForm", () => {
  const form = (over: { draft?: EventDraft; step?: 1 | 2 | 3 | 4 | 5; errors?: string[]; submitting?: boolean; failed?: boolean } = {}) =>
    renderToStaticMarkup(
      createElement(EventDraftForm, {
        draft: over.draft ?? EMPTY_EVENT_DRAFT,
        step: over.step ?? 1,
        mode: "create",
        errors: over.errors ?? [],
        submitting: over.submitting ?? false,
        failed: over.failed ?? false,
        onChange: noop,
        onNext: noop,
        onBack: noop,
        onJump: noop,
        onSaveDraft: noop,
        onPublish: noop,
      }),
    );

  it("starts on the description step and keeps the later steps on their own screens", () => {
    const first = form();
    expect(first).toContain("Основная информация");
    expect(first).toContain("Название события");
    expect(first).toContain("Например: Вечер джаза на Патриарших");
    expect(first).toContain("Краткое описание");
    expect(first).toContain("Полное описание");
    expect(first).toContain("Выберите категорию");
    expect(first).toContain("Выберите возраст");
    expect(first).toContain("Выберите дату и время");
    expect(first).toContain("Укажите длительность");
    expect(first).toContain("Далее");
    expect(first).toContain('type="datetime-local"');
    expect(first).toContain("Основное");

    const when = form({ step: 2 });
    expect(when).toContain("Адрес");
    expect(when).toContain("Локация");

    const join = form({ step: 3 });
    expect(join).toContain("Бесплатно по регистрации");
    expect(join).toContain("Покупка на другом сайте");
    expect(join).toContain("Лист ожидания");

    expect(form({ step: 4 })).toContain("Повторять каждую неделю");
    expect(form({ step: 5 })).toContain("Опубликовать");
    expect(form({ step: 5 })).toContain("Сохранить черновик");
  });

  it("shows inline errors and the failure state instead of alerting", () => {
    const html = form({ errors: ["Укажите название события"], failed: true });
    expect(html).toContain("Укажите название события");
    expect(html).toContain("Не удалось сохранить");
  });

  it("reveals the payment link only when the draft sells tickets outside the app", () => {
    expect(form({ step: 3, draft: { ...readyDraft, sellOutside: false } })).not.toContain("Ссылка на покупку");
    expect(form({ step: 3, draft: { ...readyDraft, sellOutside: true, price: "500" } })).toContain("Ссылка на покупку");
  });
});

describe("OrganizerListStatus", () => {
  it("renders the loading, error and empty states", () => {
    expect(renderToStaticMarkup(createElement(OrganizerListStatus, { state: { status: "loading" } as OrganizerListState<OrganizerEvent>, emptyText: "Пока нет событий — создайте первое." }))).toContain("Загрузка");
    expect(renderToStaticMarkup(createElement(OrganizerListStatus, { state: { status: "error" } as OrganizerListState<OrganizerEvent>, emptyText: "Пока нет событий — создайте первое." }))).toContain("Не удалось загрузить список.");
    expect(renderToStaticMarkup(createElement(OrganizerListStatus, { state: { status: "ready", items: [] } as OrganizerListState<OrganizerEvent>, emptyText: "Пока нет событий — создайте первое." }))).toContain("Пока нет событий");
    expect(renderToStaticMarkup(createElement(OrganizerListStatus, { state: { status: "ready", items: [draftEvent] } as OrganizerListState<OrganizerEvent>, emptyText: "Пока нет событий — создайте первое." }))).toBe("");
  });
});
