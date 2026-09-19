import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EMPTY_EVENT_DRAFT, EMPTY_PLACE_DRAFT, EventDraftForm, eventDraftErrors, eventDraftFrom, OrganizerEventCard, OrganizerLink, OrganizerListStatus, OrganizerPlaceCard, placeDraftErrors, toCreateEvent, toEventPatch, type EventDraft, type OrganizerListState } from "./OrganizerPage";
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
};

const readyDraft: EventDraft = { title: "Встреча книжного клуба", category: "afisha", city: "Москва", startsAt: "2026-10-20T19:00", endsAt: "", price: "", paymentUrl: "", capacity: "12" };

describe("eventDraftErrors", () => {
  it("accepts a ready draft and reports every missing required field", () => {
    expect(eventDraftErrors(readyDraft)).toEqual([]);
    expect(eventDraftErrors(EMPTY_EVENT_DRAFT)).toEqual(["Укажите название события", "Укажите город", "Укажите дату и время начала"]);
  });

  it("rejects a negative price, a paid event without a payment link and a zero capacity", () => {
    expect(eventDraftErrors({ ...readyDraft, price: "-10" })).toContain("Цена — целое число от 0");
    expect(eventDraftErrors({ ...readyDraft, price: "500" })).toContain("Для платного события нужна ссылка на оплату");
    expect(eventDraftErrors({ ...readyDraft, capacity: "0" })).toContain("Вместимость — целое число от 1");
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
    expect(draft.startsAt).toBe("2026-10-11T19:00");
    expect(draft.capacity).toBe("40");

    const patch = toEventPatch(draft);
    expect(patch.title).toBe(draftEvent.title);
    expect(patch.capacity).toBe(40);
    expect(patch).not.toHaveProperty("category");
    expect(patch).not.toHaveProperty("city");
  });
});

describe("OrganizerEventCard", () => {
  const card = (item: OrganizerEvent) => renderToStaticMarkup(createElement(OrganizerEventCard, { item, publishing: false, onPublish: noop, onEdit: noop }));

  it("shows the draft badge and the publish button on a draft", () => {
    const html = card(draftEvent);
    expect(html).toContain("Черновик");
    expect(html).toContain("Опубликовать");
    expect(html).toContain(draftEvent.title);
    expect(html).toContain("Бесплатно");
  });

  it("hides the badge and the publish button on a published event", () => {
    const html = card({ ...draftEvent, draft: false });
    expect(html).not.toContain("Черновик");
    expect(html).not.toContain("Опубликовать");
    expect(html).toContain("Изменить");
  });
});

describe("OrganizerPlaceCard", () => {
  it("shows the publish button only on drafts", () => {
    const published = renderToStaticMarkup(createElement(OrganizerPlaceCard, { item: publishedPlace, publishing: false, onPublish: noop, onEdit: noop }));
    expect(published).not.toContain("Черновик");
    expect(published).not.toContain("Опубликовать");

    const draft = renderToStaticMarkup(createElement(OrganizerPlaceCard, { item: { ...publishedPlace, draft: true }, publishing: false, onPublish: noop, onEdit: noop }));
    expect(draft).toContain("Черновик");
    expect(draft).toContain("Опубликовать");
    expect(draft).toContain(publishedPlace.address);
  });
});

describe("EventDraftForm", () => {
  const form = (over: { draft?: EventDraft; errors?: string[]; submitting?: boolean; failed?: boolean } = {}) => renderToStaticMarkup(createElement(EventDraftForm, { draft: over.draft ?? EMPTY_EVENT_DRAFT, errors: over.errors ?? [], submitting: over.submitting ?? false, failed: over.failed ?? false, submitLabel: "Создать черновик", onChange: noop, onSubmit: noop, onCancel: noop }));

  it("renders the required fields with the category options", () => {
    const html = form();
    expect(html).toContain("Название события");
    expect(html).toContain('type="datetime-local"');
    expect(html).toContain("Афиша");
    expect(html).toContain("Создать черновик");
  });

  it("shows inline errors and the failure state instead of alerting", () => {
    const html = form({ errors: ["Укажите название события"], failed: true });
    expect(html).toContain("Укажите название события");
    expect(html).toContain("Не удалось сохранить");
  });

  it("reveals the payment link input only for a paid draft", () => {
    expect(form({ draft: { ...readyDraft, price: "" } })).not.toContain("Ссылка на оплату");
    expect(form({ draft: { ...readyDraft, price: "500" } })).toContain("Ссылка на оплату");
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

describe("OrganizerLink", () => {
  it("renders the profile entry button", () => {
    expect(renderToStaticMarkup(createElement(OrganizerLink))).toContain("Панель организатора");
  });
});
