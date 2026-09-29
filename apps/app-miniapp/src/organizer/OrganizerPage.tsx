// START_MODULE_CONTRACT
// PURPOSE: Organizer panel: own events/places with draft badges, draft creation forms, publish and minimal edit (event title/time/price/capacity, place title/address/city/coords).
// SCOPE: Data via apiClient.listOrganizerEvents/createOrganizerEvent/updateOrganizerEvent/publishOrganizerEvent and the place twins; drafts flagged from the raw published field (returned by toEventDto/toPlaceDto; a missing flag reads as published); inline validation errors; mutations applied to local list state.
// DEPENDS: ../api/client.js (apiClient, OrganizerEvent, OrganizerPlace, UpdateOrganizerEvent, UpdateOrganizerPlace), ../catalog/CatalogPage.js (CATEGORY_LABELS, formatStartsAt), ./OrganizerAddons.js (MyOrganizerRatingCard, OrganizerEventAddons), ./organizer-native-back.js, ../ui/primitives.js, @max-events/api-contracts (CreateEvent, CreatePlace, EventCategory, EventCategorySchema, PlaceCategory, PlaceCategorySchema), ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PLACE_CATEGORY_LABELS - ru labels per place category
// - EventDraft - event creation/edit form draft (string fields; empty price = free, empty capacity = unlimited)
// - PlaceDraft - place creation/edit form draft (string fields)
// - EMPTY_EVENT_DRAFT - initial event form state
// - EMPTY_PLACE_DRAFT - initial place form state (coordinates default to the Moscow center)
// - eventDraftErrors - inline event validation errors (ru), empty list when ready
// - toLocalInput - format an ISO instant into the local datetime-local input value (YYYY-MM-DDTHH:mm)
// - placeDraftErrors - inline place validation errors (ru), empty list when ready
// - toCreateEvent - draft -> CreateEvent payload (call only when there are no errors)
// - toCreatePlace - draft -> CreatePlace payload
// - toEventPatch - draft -> minimal edit payload (backend PATCH whitelist fields)
// - eventDraftFrom - prefill an event draft from an existing item (edit mode)
// - placeDraftFrom - prefill a place draft from an existing item (edit mode)
// - OrganizerListState - union of the organizer list fetch states (loading / error / ready)
// - OrganizerEventCard - presentational: draft badge, title, meta, publish (drafts only) and edit buttons
// - OrganizerPlaceCard - presentational place twin
// - EventDraftForm - presentational event form with inline errors, create and edit modes
// - PlaceDraftForm - presentational place twin
// - OrganizerListStatus - presentational loading/error/empty line for a list state
// - CabinetListSwitch - «События» / «Места» in the same sliding pill as the profile tabs
// - OrganizerPanel - panel keyed by the organization id: events/places tabs, data loading, create/publish/edit mutations; renders the own-rating card and per-event stats/promotion addons from ./OrganizerAddons.js (#196/#199/#206)
// - OrganizerPage - legacy route stub: the panel lives in the organizer space (./OrganizerSpace.js) behind the organizer login
// END_MODULE_MAP

import { useEffect, useRef, useState } from "react";
import { EventCategorySchema, PlaceCategorySchema, type CreateEvent, type CreatePlace, type EventCategory, type PlaceCategory, type UpdateOrganizerEventOptions } from "@max-events/api-contracts";
import { apiClient, type OrganizerEvent, type OrganizerPlace, type UpdateOrganizerEvent } from "../api/client";
import { CATEGORY_LABELS } from "../catalog/CatalogPage";
import { posterHighlight } from "../search/EventPoster";
import { pictured } from "../ui/photos";
import { CABINET_EVENTS, mergeCabinetEvents } from "./cabinet-catalog";
import { weeklySeriesUntil } from "./OrganizerEventForm";
import { SettingsSwitchRow } from "../profile/SettingsPage";
import { ActionIcon } from "../ui/icons";
import { AppButton, AppChip, AppMedia, AppState } from "../ui/primitives";
import { useOrganizerNativeBack } from "./organizer-native-back";
import { VenuePinMap } from "./VenuePinMap";

export const PLACE_CATEGORY_LABELS: Record<PlaceCategory, string> = {
  park: "Парк",
  museum: "Музей",
  food: "Еда",
  sport: "Спорт",
  other: "Другое",
};

export interface EventDraft {
  title: string;
  description: string;
  category: EventCategory;
  city: string;
  startsAt: string;
  endsAt: string;
  price: string;
  paymentUrl: string;
  capacity: string;
  /** Free-text venue line. Empty together with `pinned` means the event has no place. */
  address: string;
  latitude: string;
  longitude: string;
  /** True after the organizer taps the map. A typed address alone does not move the pin. */
  pinned: boolean;
  placeId: string;
  waitlistEnabled: boolean;
  registrationInApp: boolean;
  externalUrl: string;
  repeatWeekly: boolean;
  /** Price is collected on the organizer's site. Empty price must not silently mean this mode. */
  sellOutside: boolean;
  summary: string;
  age: string;
  duration: string;
  /** False until the category menu is used, so the field can show its placeholder. */
  categorySet: boolean;
}

export interface PlaceDraft {
  title: string;
  address: string;
  city: string;
  category: PlaceCategory;
  latitude: string;
  longitude: string;
}

export const EMPTY_EVENT_DRAFT: EventDraft = { title: "", description: "", category: "afisha", city: "", startsAt: "", endsAt: "", price: "", paymentUrl: "", capacity: "", address: "", latitude: "55.7558", longitude: "37.6173", pinned: false, placeId: "", waitlistEnabled: false, registrationInApp: true, externalUrl: "", repeatWeekly: false, sellOutside: false, summary: "", age: "", duration: "", categorySet: false };

const PLACE_FOR_EVENT: Record<EventCategory, PlaceCategory> = { afisha: "other", volunteering: "other", tourism: "park", sport: "sport" };

/** A venue to create or update when the organizer typed an address or dropped a pin. Null when they left both empty. */
export function venueFromEventDraft(draft: EventDraft): CreatePlace | null {
  if (draft.address.trim() === "" && !draft.pinned) return null;
  const latitude = Number(draft.latitude);
  const longitude = Number(draft.longitude);
  return {
    title: draft.title.trim() || "Площадка",
    address: draft.address.trim() || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    city: draft.city.trim(),
    category: PLACE_FOR_EVENT[draft.category],
    latitude,
    longitude,
  };
}

/** Place coordinates are optional in the UI and default to the Moscow center (the demo city of the fixtures). */
export const EMPTY_PLACE_DRAFT: PlaceDraft = { title: "", address: "", city: "", category: "other", latitude: "55.7558", longitude: "37.6173" };

/** Format a Date into the local `datetime-local` input value (YYYY-MM-DDTHH:mm in the machine's local zone). */
export function toLocalInput(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}T${hh}:${min}`;
}

export function eventDraftErrors(draft: EventDraft): string[] {
  const errors: string[] = [];
  if (draft.title.trim() === "") errors.push("Укажите название события");
  if (draft.city.trim() === "") errors.push("Укажите город");
  if (draft.startsAt === "") errors.push("Укажите дату и время начала");
  if (draft.startsAt !== "" && draft.endsAt !== "" && new Date(draft.endsAt) < new Date(draft.startsAt)) errors.push("Окончание не может быть раньше начала");
  const price = draft.price.trim() === "" ? null : Number(draft.price);
  if (price !== null && (!Number.isInteger(price) || price < 0)) errors.push("Цена — целое число от 0");
  if (draft.sellOutside && (price === null || price <= 0)) errors.push("Укажите цену билета");
  if ((draft.sellOutside || (price !== null && price > 0)) && draft.paymentUrl.trim() === "") errors.push("Добавьте ссылку на покупку");
  if (price !== null && price > 0 && draft.paymentUrl.trim() !== "") {
    try {
      new URL(draft.paymentUrl.trim());
    } catch {
      errors.push("Ссылка на покупку должна начинаться с https://");
    }
  }
  if (draft.capacity.trim() !== "" && (!Number.isInteger(Number(draft.capacity)) || Number(draft.capacity) < 1)) errors.push("Вместимость — целое число от 1");
  if (draft.waitlistEnabled && draft.capacity.trim() === "") errors.push("Лист ожидания нужен только там, где есть предел мест");
  if (!draft.registrationInApp && draft.externalUrl.trim() === "") errors.push("Укажите ссылку на регистрацию на вашем сайте");
  if (!draft.registrationInApp && draft.externalUrl.trim() !== "") {
    try {
      new URL(draft.externalUrl.trim());
    } catch {
      errors.push("Ссылка на регистрацию должна начинаться с https://");
    }
  }
  return errors;
}

export type EventWizardStep = 1 | 2 | 3 | 4 | 5;

const WIZARD_STEP_TITLES = ["Основное", "Локация", "Билеты", "Продвижение", "Публикация"] as const;

export function eventWizardTitle(step: EventWizardStep): string {
  return WIZARD_STEP_TITLES[step - 1];
}

/** Errors that block leaving this step. The last step repeats the full list. */
export function eventDraftStepErrors(draft: EventDraft, step: EventWizardStep): string[] {
  const all = eventDraftErrors(draft);
  if (step === 5) return all;
  return all.filter((error) => {
    if (step === 1) return error.startsWith("Укажите название");
    if (step === 2) return error.includes("город") || error.includes("дату") || error.includes("Окончание");
    if (step === 3) return error.includes("Цен") || error.includes("покуп") || error.includes("Вместимость") || error.includes("Лист") || error.includes("регистрац");
    return false;
  });
}

export function toEventOptions(draft: EventDraft): UpdateOrganizerEventOptions {
  const date = draft.startsAt.slice(0, 10);
  const until = draft.repeatWeekly && date !== "" ? weeklySeriesUntil(date) : "";
  return {
    waitlistEnabled: draft.waitlistEnabled,
    registrationInApp: draft.registrationInApp,
    externalUrl: draft.registrationInApp ? null : draft.externalUrl.trim(),
    recurrence: until === "" ? null : { rule: "weekly", until: new Date(`${until}T23:59:00`).toISOString() },
  };
}

export function placeDraftErrors(draft: PlaceDraft): string[] {
  const errors: string[] = [];
  if (draft.title.trim() === "") errors.push("Укажите название места");
  if (draft.address.trim() === "") errors.push("Укажите адрес");
  if (draft.city.trim() === "") errors.push("Укажите город");
  const latitude = Number(draft.latitude);
  const longitude = Number(draft.longitude);
  if (draft.latitude.trim() === "" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) errors.push("Широта — число от -90 до 90");
  if (draft.longitude.trim() === "" || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) errors.push("Долгота — число от -180 до 180");
  return errors;
}

export function toCreateEvent(draft: EventDraft): CreateEvent {
  const price = draft.price.trim() === "" ? null : Number(draft.price);
  const paid = price !== null && price > 0;
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    category: draft.category,
    city: draft.city.trim(),
    placeId: draft.placeId === "" ? null : draft.placeId,
    startsAt: new Date(draft.startsAt).toISOString(),
    endsAt: draft.endsAt === "" ? null : new Date(draft.endsAt).toISOString(),
    isPaid: paid,
    priceRub: price,
    paymentUrl: paid ? draft.paymentUrl.trim() : null,
    capacity: draft.capacity.trim() === "" ? null : Number(draft.capacity),
    coverUrl: null,
  };
}

export function toCreatePlace(draft: PlaceDraft): CreatePlace {
  return { title: draft.title.trim(), address: draft.address.trim(), city: draft.city.trim(), category: draft.category, latitude: Number(draft.latitude), longitude: Number(draft.longitude) };
}

export function toEventPatch(draft: EventDraft): UpdateOrganizerEvent {
  const created = toCreateEvent(draft);
  return { title: created.title, description: created.description, category: created.category, city: created.city, placeId: created.placeId, startsAt: created.startsAt, endsAt: created.endsAt, isPaid: created.isPaid, priceRub: created.priceRub, paymentUrl: created.paymentUrl, capacity: created.capacity };
}

export function eventDraftFrom(item: OrganizerEvent, place?: OrganizerPlace): EventDraft {
  return {
    title: item.title,
    description: item.description,
    category: item.category,
    city: item.city,
    startsAt: toLocalInput(item.startsAt),
    endsAt: item.endsAt === null ? "" : toLocalInput(item.endsAt),
    price: item.priceRub === null ? "" : String(item.priceRub),
    paymentUrl: item.paymentUrl ?? "",
    capacity: item.capacity === null ? "" : String(item.capacity),
    address: place?.address ?? "",
    latitude: place === undefined ? "55.7558" : String(place.latitude),
    longitude: place === undefined ? "37.6173" : String(place.longitude),
    pinned: place !== undefined,
    placeId: item.placeId ?? "",
    waitlistEnabled: item.capacity !== null,
    registrationInApp: true,
    externalUrl: "",
    repeatWeekly: false,
    sellOutside: item.isPaid || (item.priceRub !== null && item.priceRub > 0),
    summary: "",
    age: "0+",
    duration: "",
    categorySet: true,
  };
}

export function placeDraftFrom(item: OrganizerPlace): PlaceDraft {
  return { title: item.title, address: item.address, city: item.city, category: item.category, latitude: String(item.latitude), longitude: String(item.longitude) };
}

export type OrganizerListState<T> = { status: "loading" } | { status: "error" } | { status: "ready"; items: T[] };

export function OrganizerListStatus<T>({ state, emptyText }: { state: OrganizerListState<T>; emptyText: string }) {
  if (state.status === "loading") return <AppState>Загрузка…</AppState>;
  if (state.status === "error") return <AppState error>Не удалось загрузить список.</AppState>;
  if (state.items.length === 0) return <AppState>{emptyText}</AppState>;
  return null;
}

export function splitOrganizerEvents(items: OrganizerEvent[], now = Date.now()): { drafts: OrganizerEvent[]; upcoming: OrganizerEvent[]; past: OrganizerEvent[] } {
  const drafts: OrganizerEvent[] = [];
  const upcoming: OrganizerEvent[] = [];
  const past: OrganizerEvent[] = [];
  for (const item of items) {
    if (item.draft) drafts.push(item);
    else if (new Date(item.endsAt ?? item.startsAt).getTime() < now) past.push(item);
    else upcoming.push(item);
  }
  return { drafts, upcoming, past };
}

export function OrganizerEventCard({ item, placeTitle = null, failed, onOpen }: { item: OrganizerEvent; placeTitle?: string | null; publishing?: boolean; failed: boolean; onOpen?: () => void; onPublish?: () => void; onEdit?: () => void }) {
  const when = new Date(item.startsAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const highlight = posterHighlight({ event: item, distanceKm: null, rating: null, placeTitle });
  const where = placeTitle !== null && placeTitle !== "" ? placeTitle : item.city;
  const face = (
    <>
      <span className="app-poster-photo">
        <img alt="" src={pictured(item.id, item.coverUrl)} />
      </span>
      <span className="app-poster-copy">
        {item.draft ? <span className="app-poster-host">Черновик</span> : item.organizerName ? <span className="app-poster-host">{item.organizerName}</span> : null}
        <span className="app-poster-title">{item.title}</span>
        <span className="app-poster-meta">
          {when}
          {where !== "" ? ` · ${where}` : ""}
        </span>
        {highlight !== null && <span className="app-poster-highlight">{highlight}</span>}
      </span>
    </>
  );
  return (
    <article className="app-poster">
      {onOpen !== undefined ? (
        <button type="button" className="app-poster-main" onClick={onOpen}>
          {face}
        </button>
      ) : (
        face
      )}
      {failed && <AppState error>Не удалось опубликовать. Попробуйте ещё раз.</AppState>}
    </article>
  );
}

export function OrganizerPlaceCard({ item, publishing, failed, onPublish, onOpen }: { item: OrganizerPlace; publishing: boolean; failed: boolean; onPublish: () => void; onOpen: () => void }) {
  return (
    <article className="app-card app-card--row">
      <button type="button" className="app-poster-main" onClick={onOpen}>
        <AppMedia category={item.category === "sport" ? "sport" : item.category === "park" ? "tourism" : "afisha"} />
        <span className="app-card-body">
          <span className="app-card-title">{item.title}</span>
          <span className="app-card-subtitle">
            {item.address} · {item.city}
          </span>
          <span className="app-card-subtitle">{PLACE_CATEGORY_LABELS[item.category]}</span>
          {item.draft && <span className="app-micro-badge">Черновик</span>}
        </span>
      </button>
      {failed && <AppState error>Не удалось опубликовать. Попробуйте ещё раз.</AppState>}
      {item.draft && (
        <AppButton stretched disabled={publishing} onClick={onPublish}>
          {publishing ? "Публикация…" : "Опубликовать"}
        </AppButton>
      )}
    </article>
  );
}

interface EventDraftFormProps {
  draft: EventDraft;
  step: EventWizardStep;
  errors: string[];
  submitting: boolean;
  failed: boolean;
  mode: "create" | "edit";
  offerPublish?: boolean;
  onChange: (field: keyof EventDraft, value: string | boolean) => void;
  onNext: () => void;
  onBack: () => void;
  onJump: (step: EventWizardStep) => void;
  onSaveDraft: () => void;
  onPublish: () => void;
}

const AGE_OPTIONS = ["0+", "6+", "12+", "16+", "18+"] as const;
const DURATION_OPTIONS = [
  ["1", "1 час"],
  ["2", "2 часа"],
  ["3", "3 часа"],
  ["4", "4 часа"],
] as const;

function endsAfter(startsAt: string, hours: string): string {
  if (startsAt === "" || hours === "") return "";
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return "";
  return toLocalInput(new Date(start.getTime() + Number(hours) * 3_600_000).toISOString());
}

function formatDraftWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Выберите дату и время";
  return date.toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

export function EventDraftForm({ draft, step, errors, submitting, failed, mode, offerPublish = false, onChange, onNext, onBack, onJump, onSaveDraft, onPublish }: EventDraftFormProps) {
  useOrganizerNativeBack(true, onBack);
  const canPublish = mode === "create" || offerPublish;
  const participation = draft.sellOutside ? "Покупка на другом сайте" : "Бесплатно по регистрации";
  const stepTitle = ["Основная информация", "Локация", "Билеты", "Продвижение", "Публикация"][step - 1];
  return (
    <form
      className="app-make"
      onSubmit={(submit) => {
        submit.preventDefault();
        if (step < 5) onNext();
        else if (canPublish) onPublish();
        else onSaveDraft();
      }}
    >
      <ol className="app-make-steps">
        {WIZARD_STEP_TITLES.map((label, index) => (
          <li key={label}>
            <button type="button" className={index + 1 === step ? "app-make-step app-make-step--on" : "app-make-step"} onClick={() => onJump((index + 1) as EventWizardStep)}>
              <span>{index + 1}</span>
              {label}
            </button>
          </li>
        ))}
      </ol>
      <h2 className="app-make-title">{stepTitle}</h2>
      {step === 1 && (
        <>
          <button type="button" className="app-make-cover">
            <span className="app-make-camera" aria-hidden="true">
              <ActionIcon name="camera" size={22} strokeWidth={1.8} />
            </span>
            <span>Добавить обложку и фото (до 10)</span>
          </button>
          <label className="app-make-field">
            <span>
              Название события <i>*</i>
            </span>
            <input type="text" aria-label="Название события" placeholder="Например: Вечер джаза на Патриарших" value={draft.title} onChange={(change) => onChange("title", change.target.value)} />
          </label>
          <label className="app-make-field">
            <span>
              Краткое описание <i>*</i>
            </span>
            <input type="text" aria-label="Краткое описание" placeholder="Коротко о событии, 1–2 предложения" value={draft.summary} onChange={(change) => onChange("summary", change.target.value)} />
          </label>
          <label className="app-make-field">
            <span>
              Полное описание <i>*</i>
            </span>
            <span className="app-make-count">{draft.description.length}/2000</span>
            <textarea aria-label="Полное описание" maxLength={2000} rows={4} placeholder="Расскажите подробнее о событии, артистах, программе, преимуществах и т.д." value={draft.description} onChange={(change) => onChange("description", change.target.value)} />
          </label>
          <label className="app-make-field">
            <span>
              Категория <i>*</i>
            </span>
            <select
              aria-label="Категория"
              value={draft.categorySet ? draft.category : ""}
              onChange={(change) => {
                onChange("category", change.target.value);
                onChange("categorySet", true);
              }}
            >
              <option value="">Выберите категорию</option>
              {EventCategorySchema.options.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </label>
          <label className="app-make-field">
            <span>
              Возрастное ограничение <i>*</i>
            </span>
            <select aria-label="Возрастное ограничение" value={draft.age} onChange={(change) => onChange("age", change.target.value)}>
              <option value="">Выберите возраст</option>
              {AGE_OPTIONS.map((age) => (
                <option key={age} value={age}>
                  {age}
                </option>
              ))}
            </select>
          </label>
          <label className="app-make-field">
            <span>
              Дата и время <i>*</i>
            </span>
            <span className="app-make-fake">
              <ActionIcon name="calendar" size={18} strokeWidth={2} />
              {draft.startsAt === "" ? "Выберите дату и время" : formatDraftWhen(draft.startsAt)}
              <input type="datetime-local" aria-label="Начало" value={draft.startsAt} onChange={(change) => onChange("startsAt", change.target.value)} />
            </span>
          </label>
          <label className="app-make-field">
            <span>Длительность</span>
            <span className="app-make-fake">
              <ActionIcon name="clock" size={18} strokeWidth={2} />
              {DURATION_OPTIONS.find((item) => item[0] === draft.duration)?.[1] ?? "Укажите длительность"}
              <select
                aria-label="Длительность"
                value={draft.duration}
                onChange={(change) => {
                  onChange("duration", change.target.value);
                  onChange("endsAt", endsAfter(draft.startsAt, change.target.value));
                }}
              >
                <option value="">Укажите длительность</option>
                {DURATION_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </span>
          </label>
        </>
      )}
      {step === 2 && (
        <>
          <label className="app-make-field">
            <span>
              Город <i>*</i>
            </span>
            <input type="text" aria-label="Город" placeholder="Москва" value={draft.city} onChange={(change) => onChange("city", change.target.value)} />
          </label>
          <label className="app-make-field">
            <span>Адрес</span>
            <input type="text" aria-label="Адрес" placeholder="Улица и дом" value={draft.address} onChange={(change) => onChange("address", change.target.value)} />
          </label>
          <VenuePinMap
            latitude={Number(draft.latitude)}
            longitude={Number(draft.longitude)}
            onPick={(latitude, longitude) => {
              onChange("latitude", latitude.toFixed(6));
              onChange("longitude", longitude.toFixed(6));
              onChange("pinned", true);
            }}
          />
        </>
      )}
      {step === 3 && (
        <>
          <div className="app-set-group" role="radiogroup" aria-label="Способ участия">
            <button
              type="button"
              className="app-set-row"
              aria-pressed={!draft.sellOutside}
              onClick={() => {
                onChange("sellOutside", false);
                onChange("price", "");
                onChange("paymentUrl", "");
                onChange("registrationInApp", true);
              }}
            >
              <span className="app-set-row-text">
                <span className="app-set-row-title">Бесплатно по регистрации</span>
                <span className="app-set-row-hint">Гость записывается в приложении. Оплаты нет.</span>
              </span>
            </button>
            <button
              type="button"
              className="app-set-row"
              aria-pressed={draft.sellOutside}
              onClick={() => {
                onChange("sellOutside", true);
                onChange("registrationInApp", true);
              }}
            >
              <span className="app-set-row-text">
                <span className="app-set-row-title">Покупка на другом сайте</span>
                <span className="app-set-row-hint">Гость отмечает участие здесь и переходит на вашу ссылку. Сумма заказа в кабинет не приходит.</span>
              </span>
            </button>
          </div>
          <p className="app-gathering-hint">Продажа билетов внутри приложения и вход совсем без записи не подключены.</p>
          {draft.sellOutside && (
            <>
              <label className="app-org-field">
                <span className="app-org-field-label">Цена, ₽</span>
                <input className="app-profile-input" type="number" min={1} aria-label="Цена билета" placeholder="1500" value={draft.price} onChange={(change) => onChange("price", change.target.value)} />
              </label>
              <label className="app-org-field">
                <span className="app-org-field-label">Ссылка на покупку</span>
                <input className="app-profile-input" type="url" aria-label="Ссылка на покупку" placeholder="https://" value={draft.paymentUrl} onChange={(change) => onChange("paymentUrl", change.target.value)} />
              </label>
            </>
          )}
          <label className="app-org-field">
            <span className="app-org-field-label">Лимит участников</span>
            <input className="app-profile-input" type="number" min={1} aria-label="Лимит участников" placeholder="Без предела" value={draft.capacity} onChange={(change) => onChange("capacity", change.target.value)} />
          </label>
          <SettingsSwitchRow title="Лист ожидания" hint="Только если задан лимит мест" checked={draft.waitlistEnabled} onChange={(waitlistEnabled) => onChange("waitlistEnabled", waitlistEnabled)} />
        </>
      )}
      {step === 4 && (
        <>
          <SettingsSwitchRow title="Повторять каждую неделю" hint="В настройках сохранится пометка. Отдельные сеансы по датам сами не создаются." checked={draft.repeatWeekly} onChange={(repeatWeekly) => onChange("repeatWeekly", repeatWeekly)} />
          <p className="app-gathering-hint">Контакт для гостей задаётся в профиле организации. Чат события появится, когда оно уйдёт в чаты MAX. Продвижение к созданию не привязано.</p>
        </>
      )}
      {step === 5 && (
        <>
          <div className="app-set-group">
            {(
              [
                [1, "О событии", draft.title.trim() === "" ? "Название не указано" : draft.title],
                [2, "Дата и место", draft.startsAt === "" ? "Дата не указана" : `${draft.startsAt}${draft.city === "" ? "" : ` · ${draft.city}`}`],
                [3, "Участие", participation],
                [3, "Цена", draft.sellOutside ? (draft.price === "" ? "Цена не указана" : `${draft.price} ₽ · ${draft.paymentUrl || "ссылка не указана"}`) : "Бесплатно"],
              ] as Array<[EventWizardStep, string, string]>
            ).map(([target, title, value]) => (
              <button key={title} type="button" className="app-set-row" onClick={() => onJump(target)}>
                <span className="app-set-row-text">
                  <span className="app-set-row-title">{title}</span>
                  <span className="app-set-row-hint">{value}</span>
                </span>
                <span className="app-set-row-value">Изменить</span>
              </button>
            ))}
          </div>
          <p className="app-gathering-hint">Публикация сразу открывает событие в афише. Отдельной проверки модератором нет.</p>
        </>
      )}
      {errors.map((error) => (
        <p key={error} className="app-state app-state--error">
          {error}
        </p>
      ))}
      {failed && <AppState error>Не удалось сохранить. Попробуйте ещё раз.</AppState>}
      <button type="submit" className="app-make-next" disabled={submitting}>
        {step < 5 ? "Далее →" : submitting ? "Сохранение…" : canPublish ? "Опубликовать" : "Сохранить"}
      </button>
      {step === 5 && canPublish && (
        <button type="button" className="app-make-draft" disabled={submitting} onClick={onSaveDraft}>
          Сохранить черновик
        </button>
      )}
    </form>
  );
}

interface PlaceDraftFormProps {
  draft: PlaceDraft;
  errors: string[];
  submitting: boolean;
  failed: boolean;
  submitLabel: string;
  onChange: (field: keyof PlaceDraft, value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function PlaceDraftForm({ draft, errors, submitting, failed, submitLabel, onChange, onSubmit, onCancel }: PlaceDraftFormProps) {
  return (
    <form
      className="app-profile-form"
      onSubmit={(submit) => {
        submit.preventDefault();
        onSubmit();
      }}
    >
      <p className="app-gathering-hint">Фото, часы работы и описание места кабинет не хранит. Гости видят название и адрес.</p>
      <p className="app-org-group-title">Название и категория</p>
      <label className="app-org-field">
        <span className="app-org-field-label">Название</span>
        <input className="app-profile-input" type="text" aria-label="Название" placeholder="Название места" value={draft.title} onChange={(change) => onChange("title", change.target.value)} />
      </label>
      <p className="app-org-group-title">Адрес и точка</p>
      <label className="app-org-field">
        <span className="app-org-field-label">Адрес</span>
        <input className="app-profile-input" type="text" aria-label="Адрес" placeholder="Улица и дом, или точка на карте" value={draft.address} onChange={(change) => onChange("address", change.target.value)} />
      </label>
      <label className="app-org-field">
        <span className="app-org-field-label">Город</span>
        <input className="app-profile-input" type="text" aria-label="Город" placeholder="Город" value={draft.city} onChange={(change) => onChange("city", change.target.value)} />
      </label>
      <div className="app-org-choice" role="group" aria-label="Категория">
        {PlaceCategorySchema.options.map((category) => (
          <AppChip key={category} pressed={draft.category === category} onClick={() => onChange("category", category)}>
            {PLACE_CATEGORY_LABELS[category]}
          </AppChip>
        ))}
      </div>
      <VenuePinMap
        latitude={Number(draft.latitude)}
        longitude={Number(draft.longitude)}
        onPick={(latitude, longitude) => {
          onChange("latitude", latitude.toFixed(6));
          onChange("longitude", longitude.toFixed(6));
        }}
      />
      {errors.map((error) => (
        <p key={error} className="app-state app-state--error">
          {error}
        </p>
      ))}
      {failed && <AppState error>Не удалось сохранить. Попробуйте ещё раз.</AppState>}
      <AppButton disabled={submitting} type="submit" stretched>
        {submitting ? "Сохранение…" : submitLabel}
      </AppButton>
      <AppButton type="button" stretched onClick={onCancel}>
        Отмена
      </AppButton>
    </form>
  );
}

function PlaceManage({ place, events, onBack, onEdit, onCreate }: { place: OrganizerPlace; events: OrganizerEvent[]; onBack: () => void; onEdit: () => void; onCreate: () => void }) {
  useOrganizerNativeBack(true, onBack);
  const linked = events.filter((item) => item.placeId === place.id);
  return (
    <section className="app-gathering" aria-label="Управление местом">
      <article className="app-set-group">
        <p className="app-set-row-title">{place.title}</p>
        <p className="app-set-row-hint">
          {place.address} · {place.city}
        </p>
        <p className="app-set-row-hint">
          {place.draft ? "Черновик" : "Опубликовано"} · {PLACE_CATEGORY_LABELS[place.category]}
        </p>
      </article>
      <p className="app-gathering-hint">Гости видят этот адрес на карточке события. Отдельной страницы места в афише кабинет не открывает.</p>
      <button type="button" className="app-set-row" onClick={onEdit}>
        <span className="app-set-row-text">
          <span className="app-set-row-title">Редактировать</span>
          <span className="app-set-row-hint">Название, категория, адрес и точка</span>
        </span>
      </button>
      <h2 className="app-section-title">События здесь</h2>
      {linked.length === 0 && <p className="app-gathering-hint">Событий на этой площадке пока нет. Место может существовать само по себе.</p>}
      {linked.map((item) => (
        <p key={item.id} className="app-set-row-hint">
          {item.title}
        </p>
      ))}
      <AppButton stretched onClick={onCreate}>
        Создать событие здесь
      </AppButton>
    </section>
  );
}

type EventFormState = { mode: "create"; draft: EventDraft } | { mode: "edit"; id: string; draft: EventDraft; offerPublish: boolean } | null;
type PlaceFormState = { mode: "create"; draft: PlaceDraft } | { mode: "edit"; id: string; draft: PlaceDraft } | null;

function sortEvents(items: OrganizerEvent[]): OrganizerEvent[] {
  return [...items].sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
}

function sortPlaces(items: OrganizerPlace[]): OrganizerPlace[] {
  return [...items].sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}

function upsert<T extends { id: string }>(items: T[], item: T): T[] {
  return items.some((existing) => existing.id === item.id) ? items.map((existing) => (existing.id === item.id ? item : existing)) : [...items, item];
}

export type CabinetListTab = "events" | "places";

/** Same sliding pill as the profile «Посты / Места / Сохранённое» switch, with two labels. */
export function CabinetListSwitch({ tab, onTab }: { tab: CabinetListTab; onTab: (tab: CabinetListTab) => void }) {
  const tabs: CabinetListTab[] = ["events", "places"];
  return (
    <div
      className="app-me-tabs"
      role="tablist"
      aria-label="События и места"
      style={{ ["--me-tabs" as string]: 2, ["--me-tab" as string]: tab === "places" ? 1 : 0, marginTop: 0 }}
      onPointerDown={(event) => {
        const host = event.currentTarget;
        const pick = (clientX: number) => {
          const box = host.getBoundingClientRect();
          const next = Math.min(tabs.length - 1, Math.max(0, Math.floor(((clientX - box.left) / Math.max(box.width, 1)) * tabs.length)));
          const chosen = tabs[next];
          if (chosen !== undefined) onTab(chosen);
        };
        host.setPointerCapture(event.pointerId);
        pick(event.clientX);
        const move = (pointer: PointerEvent) => {
          if (pointer.pointerId !== event.pointerId) return;
          pick(pointer.clientX);
        };
        const up = (pointer: PointerEvent) => {
          if (pointer.pointerId !== event.pointerId) return;
          host.removeEventListener("pointermove", move);
          host.removeEventListener("pointerup", up);
        };
        host.addEventListener("pointermove", move);
        host.addEventListener("pointerup", up);
      }}
    >
      <span className="app-me-tab-pill" aria-hidden="true" />
      <button type="button" role="tab" aria-selected={tab === "events"} className={tab === "events" ? "app-me-tab app-me-tab--active" : "app-me-tab"} onClick={() => onTab("events")}>
        События
      </button>
      <button type="button" role="tab" aria-selected={tab === "places"} className={tab === "places" ? "app-me-tab app-me-tab--active" : "app-me-tab"} onClick={() => onTab("places")}>
        Места
      </button>
    </div>
  );
}

/** createOnMount: the «Создать» tab of the organizer bar lands straight on the empty event draft. */
export function OrganizerPanel({ organizationId: _organizationId, createOnMount = false, onOpenEvent: _onOpenEvent, onComposer, closeComposerTick = 0, editRequestId = null, onEditHandled, placesTick = 0, draftsTick = 0 }: { organizationId: string; createOnMount?: boolean; onOpenEvent?: (event: OrganizerEvent) => void; onComposer?: (title: string | null) => void; closeComposerTick?: number; editRequestId?: string | null; onEditHandled?: () => void; placesTick?: number; draftsTick?: number }) {
  const [tab, setTab] = useState<"events" | "places">("events");
  const [eventQuery, setEventQuery] = useState("");
  const [eventFilter, setEventFilter] = useState<"all" | "published" | "drafts" | "archive">("all");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"info" | "tickets" | "stats">("info");
  const [placeQuery, setPlaceQuery] = useState("");
  const [events, setEvents] = useState<OrganizerListState<OrganizerEvent>>({ status: "loading" });
  const [places, setPlaces] = useState<OrganizerListState<OrganizerPlace>>({ status: "loading" });
  const [eventForm, setEventForm] = useState<EventFormState>(createOnMount ? { mode: "create", draft: EMPTY_EVENT_DRAFT } : null);
  const [step, setStep] = useState<EventWizardStep>(1);
  const [placeForm, setPlaceForm] = useState<PlaceFormState>(null);
  const [placeFocus, setPlaceFocus] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishErrorId, setPublishErrorId] = useState<string | null>(null);
  const seenEdit = useRef<string | null>(null);
  const createdEventId = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    apiClient.listOrganizerEvents().then(
      (items) => {
        if (alive) setEvents({ status: "ready", items: sortEvents(items) });
      },
      () => {
        if (alive) setEvents({ status: "error" });
      },
    );
    apiClient.listOrganizerPlaces().then(
      (items) => {
        if (alive) setPlaces({ status: "ready", items: sortPlaces(items) });
      },
      () => {
        if (alive) setPlaces({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const openEventForm = (next: EventFormState) => {
    setErrors([]);
    setFailed(false);
    setPlaceForm(null);
    setStep(1);
    createdEventId.current = next !== null && next.mode === "edit" ? next.id : null;
    setEventForm(next);
  };

  useEffect(() => {
    if (placesTick > 0) setTab("places");
  }, [placesTick]);

  useEffect(() => {
    if (draftsTick > 0) {
      setTab("events");
      setEventFilter("drafts");
    }
  }, [draftsTick]);

  useEffect(() => {
    if (editRequestId === null) {
      seenEdit.current = null;
      return;
    }
    if (events.status !== "ready" || places.status === "loading" || seenEdit.current === editRequestId) return;
    const item = events.items.find((event) => event.id === editRequestId);
    if (item === undefined) return;
    seenEdit.current = editRequestId;
    const place = places.status === "ready" ? places.items.find((row) => row.id === item.placeId) : undefined;
    setErrors([]);
    setFailed(false);
    setPlaceForm(null);
    setPlaceFocus(null);
    setTab("events");
    setStep(1);
    setEventForm({ mode: "edit", id: item.id, draft: eventDraftFrom(item, place), offerPublish: item.draft });
    apiClient.getOrganizerEventOptions(item.id).then(
      (options) => {
        setEventForm((current) => (current !== null && current.mode === "edit" && current.id === item.id ? { ...current, draft: { ...current.draft, waitlistEnabled: options.waitlistEnabled, registrationInApp: options.registrationInApp, externalUrl: options.externalUrl ?? "", repeatWeekly: options.recurrence?.rule === "weekly" } } : current));
      },
      () => {},
    );
    onEditHandled?.();
  }, [editRequestId, events, places, onEditHandled]);

  useEffect(() => {
    const title = eventForm !== null ? (eventForm.mode === "create" ? "Создать событие" : "Событие") : placeForm !== null ? (placeForm.mode === "create" ? "Новое место" : "Место") : detailId !== null ? "Событие" : null;
    onComposer?.(title);
  }, [eventForm, placeForm, step, detailId, onComposer]);

  useEffect(() => {
    if (closeComposerTick === 0) return;
    setEventForm(null);
    setPlaceForm(null);
    setDetailId(null);
    setStep(1);
    createdEventId.current = null;
    setErrors([]);
    setFailed(false);
  }, [closeComposerTick]);

  const openPlaceForm = (next: PlaceFormState) => {
    setErrors([]);
    setFailed(false);
    setEventForm(null);
    setPlaceForm(next);
  };

  const submitEvent = (publish: boolean) => {
    if (eventForm === null) return;
    const nextErrors = eventDraftErrors(eventForm.draft);
    setErrors(nextErrors);
    if (nextErrors.length > 0) {
      setStep(5);
      return;
    }
    setSubmitting(true);
    setFailed(false);
    const draft = eventForm.draft;
    const venue = venueFromEventDraft(draft);
    const placeReady =
      venue === null
        ? Promise.resolve(draft.placeId)
        : draft.placeId !== ""
          ? apiClient.updateOrganizerPlace(draft.placeId, venue).then(() => draft.placeId)
          : apiClient.createOrganizerPlace(venue).then((place) => {
              setPlaces((current) => (current.status === "ready" ? { status: "ready", items: sortPlaces(upsert(current.items, place)) } : current));
              return place.id;
            });
    const request = placeReady.then((placeId) => {
      const withPlace = { ...draft, placeId };
      const existingId = eventForm.mode === "edit" ? eventForm.id : createdEventId.current;
      const saved = existingId === null ? apiClient.createOrganizerEvent(toCreateEvent(withPlace)) : apiClient.updateOrganizerEvent(existingId, toEventPatch(withPlace));
      return saved.then((item) => {
        createdEventId.current = item.id;
        return apiClient.updateOrganizerEventOptions(item.id, toEventOptions(withPlace)).then(() => item);
      });
    });
    request
      .then((item) => {
        setEvents((current) => (current.status === "ready" ? { status: "ready", items: sortEvents(upsert(current.items, item)) } : current));
        if (!publish) return item;
        const placePublished = item.placeId === null ? Promise.resolve() : apiClient.publishOrganizerPlace(item.placeId).then((place) => setPlaces((current) => (current.status === "ready" ? { status: "ready", items: sortPlaces(upsert(current.items, place)) } : current)));
        return placePublished.then(() => apiClient.publishOrganizerEvent(item.id));
      })
      .then(
        (item) => {
          setEvents((current) => (current.status === "ready" ? { status: "ready", items: sortEvents(upsert(current.items, item)) } : current));
          setSubmitting(false);
          setEventForm(null);
          setStep(1);
        },
        () => {
          setSubmitting(false);
          setFailed(true);
        },
      );
  };

  const submitPlace = () => {
    if (placeForm === null) return;
    const nextErrors = placeDraftErrors(placeForm.draft);
    setErrors(nextErrors);
    if (nextErrors.length > 0) return;
    setSubmitting(true);
    setFailed(false);
    const request = placeForm.mode === "create" ? apiClient.createOrganizerPlace(toCreatePlace(placeForm.draft)) : apiClient.updateOrganizerPlace(placeForm.id, toCreatePlace(placeForm.draft));
    request.then(
      (item) => {
        setPlaces((current) => (current.status === "ready" ? { status: "ready", items: sortPlaces(upsert(current.items, item)) } : current));
        setSubmitting(false);
        setPlaceForm(null);
      },
      () => {
        setSubmitting(false);
        setFailed(true);
      },
    );
  };

  const publishPlace = (id: string) => {
    setPublishingId(id);
    setPublishErrorId(null);
    apiClient.publishOrganizerPlace(id).then(
      (item) => {
        setPlaces((current) => (current.status === "ready" ? { status: "ready", items: upsert(current.items, item) } : current));
        setPublishingId(null);
      },
      () => {
        setPublishingId(null);
        setPublishErrorId(id);
      },
    );
  };

  if (eventForm !== null) {
    return (
      <section className="app-gathering" aria-label={eventForm.mode === "create" ? "Новое событие" : "Событие"}>
        <EventDraftForm
          draft={eventForm.draft}
          step={step}
          mode={eventForm.mode}
          offerPublish={eventForm.mode === "edit" && eventForm.offerPublish}
          errors={errors}
          submitting={submitting}
          failed={failed}
          onChange={(field, value) => setEventForm((current) => (current === null ? current : { ...current, draft: { ...current.draft, [field]: value } }))}
          onNext={() => {
            const nextErrors = eventDraftStepErrors(eventForm.draft, step);
            setErrors(nextErrors);
            if (nextErrors.length === 0) setStep((current) => (current < 5 ? ((current + 1) as EventWizardStep) : current));
          }}
          onBack={() => {
            setErrors([]);
            if (step === 1) openEventForm(null);
            else setStep((current) => (current - 1) as EventWizardStep);
          }}
          onJump={(target) => {
            setErrors([]);
            setStep(target);
          }}
          onSaveDraft={() => submitEvent(false)}
          onPublish={() => submitEvent(true)}
        />
      </section>
    );
  }

  if (placeForm !== null) {
    return (
      <section className="app-gathering" aria-label={placeForm.mode === "create" ? "Новое место" : "Место"}>
        <PlaceDraftForm draft={placeForm.draft} errors={errors} submitting={submitting} failed={failed} submitLabel={placeForm.mode === "create" ? "Сохранить место" : "Сохранить"} onChange={(field, value) => setPlaceForm((current) => (current === null ? current : { ...current, draft: { ...current.draft, [field]: value } }))} onSubmit={submitPlace} onCancel={() => openPlaceForm(null)} />
      </section>
    );
  }

  const merged = events.status === "ready" ? mergeCabinetEvents(events.items) : [];
  const groups = events.status === "ready" ? splitOrganizerEvents(merged) : null;
  const placeTitleFor = (item: OrganizerEvent) => CABINET_EVENTS.find((row) => row.id === item.id)?.place ?? (places.status === "ready" ? (places.items.find((place) => place.id === item.placeId)?.title ?? item.city) : item.city);
  const seatsSold = (item: OrganizerEvent) => {
    const known = CABINET_EVENTS.find((row) => row.id === item.id);
    if (known) return known.draft ? 0 : known.sold;
    if (item.draft || item.capacity === null) return 0;
    return Math.min(item.capacity, Math.round(item.capacity * 0.6));
  };
  const matchesQuery = (item: OrganizerEvent) => item.title.toLowerCase().includes(eventQuery.trim().toLowerCase());
  const visibleEvents = groups === null ? [] : (eventFilter === "drafts" ? groups.drafts : eventFilter === "archive" ? groups.past : eventFilter === "published" ? groups.upcoming : merged).filter(matchesQuery);
  const detail = detailId === null ? null : (merged.find((item) => item.id === detailId) ?? null);
  const renderEvents = (items: OrganizerEvent[]) => (
    <div className="app-evt-list">
      {items.map((item) => {
        const sold = seatsSold(item);
        const when = new Date(item.startsAt);
        const past = new Date(item.endsAt ?? item.startsAt).getTime() < Date.now();
        const status = item.draft ? "Черновик" : past ? "Архив" : "Опубликовано";
        return (
          <button
            key={item.id}
            type="button"
            className="app-evt-card"
            onClick={() => {
              setDetailTab("info");
              setDetailId(item.id);
            }}
          >
            <span className="app-evt-photo">
              <img alt="" src={pictured(item.id, item.coverUrl)} />
            </span>
            <span className="app-evt-copy">
              <span className="app-evt-title">{item.title}</span>
              <span className="app-evt-meta">
                {when.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {item.city}
              </span>
              <span className="app-evt-meta">
                {item.capacity === null ? "Без лимита" : `${item.capacity} мест`} · Продано: {sold}
              </span>
              <span className={item.draft ? "app-evt-status app-evt-status--draft" : past ? "app-evt-status app-evt-status--archive" : "app-evt-status"}>{status}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
  if (detail !== null && eventForm === null && placeForm === null) {
    const known = CABINET_EVENTS.find((row) => row.id === detail.id);
    const sold = seatsSold(detail);
    const free = detail.capacity === null ? null : Math.max(detail.capacity - sold, 0);
    const past = new Date(detail.endsAt ?? detail.startsAt).getTime() < Date.now();
    const start = new Date(detail.startsAt);
    const end = detail.endsAt === null ? null : new Date(detail.endsAt);
    const whenLine = `${start.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} · ${start.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}${end ? ` — ${end.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}` : ""}`;
    const whenShort = `${start.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}, ${start.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}${end ? ` – ${end.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}` : ""}`;
    const placeLine = `${placeTitleFor(detail)}, ${detail.city}`;
    const tags = known?.tags ?? [CATEGORY_LABELS[detail.category]];
    const categoryLabel = tags[0] ?? CATEGORY_LABELS[detail.category];
    const age = known?.age ?? "0+";
    const about = known?.description ?? detail.description;
    const promoCount = detail.isPaid && !detail.draft ? 2 : 0;
    return (
      <section className="app-evt-sheet" aria-label="Событие">
        <div className="app-evt-hero">
          <img alt="" src={pictured(detail.id, detail.coverUrl)} />
          <span className={detail.draft ? "app-evt-status app-evt-status--draft" : past ? "app-evt-status app-evt-status--archive" : "app-evt-status"}>{detail.draft ? "Черновик" : past ? "Архив" : "Опубликовано"}</span>
        </div>
        <h1 className="app-evt-name">{detail.title}</h1>
        <p className="app-evt-line">
          <ActionIcon name="calendar" size={18} strokeWidth={2} />
          <span>{whenLine}</span>
        </p>
        <p className="app-evt-line">
          <ActionIcon name="pin" size={18} strokeWidth={2} />
          <span>{placeLine}</span>
        </p>
        <div className="app-evt-pills">
          {tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <p className="app-evt-about">{about}</p>
        <div className="app-evt-counts">
          <article>
            <ActionIcon name="users" size={18} strokeWidth={2} />
            <b>{detail.capacity ?? "—"}</b>
            <span>Всего мест</span>
          </article>
          <article>
            <ActionIcon name="ticket" size={18} strokeWidth={2} />
            <b>{sold}</b>
            <span>Продано</span>
          </article>
          <article>
            <ActionIcon name="layers" size={18} strokeWidth={2} />
            <b>{free ?? "—"}</b>
            <span>Свободно</span>
          </article>
        </div>
        <button type="button" className="app-evt-edit" onClick={() => openEventForm({ mode: "edit", id: detail.id, draft: eventDraftFrom(detail), offerPublish: detail.draft })}>
          <ActionIcon name="pen" size={18} strokeWidth={2.2} />
          Редактировать
        </button>
        <div className="app-evt-filters" role="tablist" aria-label="Карточка события">
          {(
            [
              ["info", "Информация"],
              ["tickets", "Билеты"],
              ["stats", "Статистика"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={detailTab === id} className={detailTab === id ? "app-evt-filter app-evt-filter--on" : "app-evt-filter"} onClick={() => setDetailTab(id)}>
              {label}
            </button>
          ))}
        </div>
        {detailTab === "info" && (
          <>
            <h2 className="app-evt-block-title">Основная информация</h2>
            <div className="app-evt-rows">
              <div className="app-evt-row">
                <ActionIcon name="pin" size={18} strokeWidth={2} />
                <span>
                  <b>Локация</b>
                  <em>{placeLine}</em>
                </span>
                <ActionIcon name="chevron" size={16} strokeWidth={2.4} />
              </div>
              <div className="app-evt-row">
                <ActionIcon name="calendar" size={18} strokeWidth={2} />
                <span>
                  <b>Дата и время</b>
                  <em>{whenShort}</em>
                </span>
              </div>
              <div className="app-evt-row">
                <ActionIcon name="tag" size={18} strokeWidth={2} />
                <span>
                  <b>Категория</b>
                  <em>{categoryLabel}</em>
                </span>
                <ActionIcon name="chevron" size={16} strokeWidth={2.4} />
              </div>
              <div className="app-evt-row">
                <ActionIcon name="info" size={18} strokeWidth={2} />
                <span>
                  <b>Возрастное ограничение</b>
                  <em>{age}</em>
                </span>
              </div>
              <div className="app-evt-row">
                <ActionIcon name="info" size={18} strokeWidth={2} />
                <span>
                  <b>Описание</b>
                  <em>{known?.summary ?? about}</em>
                </span>
              </div>
            </div>
            <h2 className="app-evt-block-title">Дополнительно</h2>
            <div className="app-evt-rows">
              <div className="app-evt-row">
                <ActionIcon name="ticket" size={18} strokeWidth={2} />
                <span>
                  <b>Промокоды</b>
                  <em>Активных: {promoCount}</em>
                </span>
                <ActionIcon name="chevron" size={16} strokeWidth={2.4} />
              </div>
              <div className="app-evt-row">
                <ActionIcon name="mail" size={18} strokeWidth={2} />
                <span>
                  <b>Рассылка</b>
                  <em>Отправлено: 0</em>
                </span>
                <ActionIcon name="chevron" size={16} strokeWidth={2.4} />
              </div>
            </div>
          </>
        )}
        {detailTab === "tickets" && (
          <article className="app-cab-card">
            <h2 className="app-cab-card-title">Билеты</h2>
            <p className="app-evt-meta">{detail.isPaid && detail.priceRub !== null ? `${detail.priceRub} ₽` : "Бесплатно"}</p>
            <p className="app-evt-meta">
              Продано {sold} из {detail.capacity ?? "без лимита"}
            </p>
          </article>
        )}
        {detailTab === "stats" && (
          <article className="app-cab-card">
            <h2 className="app-cab-card-title">Статистика</h2>
            <p className="app-evt-meta">Выручка {detail.isPaid && detail.priceRub !== null ? `${(detail.priceRub * sold).toLocaleString("ru-RU")} ₽` : "0 ₽"}</p>
            <p className="app-evt-meta">Заполняемость {detail.capacity ? `${Math.round((sold / detail.capacity) * 100)}%` : "—"}</p>
          </article>
        )}
        {!detail.draft && !past && (
          <button type="button" className="app-evt-unpublish" onClick={() => setDetailId(null)}>
            Снять с публикации
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="app-gathering">
      <CabinetListSwitch tab={tab} onTab={setTab} />
      {tab === "events" && (
        <>
          <button type="button" className="app-fin-withdraw" onClick={() => openEventForm({ mode: "create", draft: EMPTY_EVENT_DRAFT })}>
            <span className="app-fin-withdraw-plus" aria-hidden="true">
              +
            </span>
            Создать событие
          </button>
          <input className="app-profile-input" aria-label="Поиск" placeholder="Поиск" value={eventQuery} onChange={(change) => setEventQuery(change.target.value)} />
          <p className="app-cab-lead">Ваши события и статистика</p>
          <div className="app-evt-filters" role="tablist" aria-label="Состояние событий">
            {(
              [
                ["all", "Все", merged.length],
                ["published", "Опубликованные", groups?.upcoming.length ?? 0],
                ["drafts", "Черновики", groups?.drafts.length ?? 0],
                ["archive", "Архив", groups?.past.length ?? 0],
              ] as const
            ).map(([id, label, count]) => (
              <button key={id} type="button" role="tab" aria-selected={eventFilter === id} className={eventFilter === id ? "app-evt-filter app-evt-filter--on" : "app-evt-filter"} onClick={() => setEventFilter(id)}>
                {label} {count}
              </button>
            ))}
          </div>
          <OrganizerListStatus state={events} emptyText="Пока нет событий — создайте первое." />
          {events.status === "ready" && events.items.length > 0 && visibleEvents.length === 0 && (
            <>
              <p className="app-gathering-hint">Ничего не найдено. Фильтр и поиск сохранены.</p>
              <AppButton
                tone="secondary"
                stretched
                onClick={() => {
                  setEventQuery("");
                  setEventFilter("all");
                }}
              >
                Сбросить
              </AppButton>
            </>
          )}
          {renderEvents(visibleEvents)}
        </>
      )}
      {tab === "places" && places.status === "ready" && placeFocus !== null && places.items.some((item) => item.id === placeFocus) && (
        <PlaceManage
          place={places.items.find((item) => item.id === placeFocus)!}
          events={events.status === "ready" ? events.items : []}
          onBack={() => setPlaceFocus(null)}
          onEdit={() => {
            const place = places.items.find((item) => item.id === placeFocus);
            if (place) openPlaceForm({ mode: "edit", id: place.id, draft: placeDraftFrom(place) });
          }}
          onCreate={() => {
            const place = places.items.find((item) => item.id === placeFocus);
            if (!place) return;
            openEventForm({ mode: "create", draft: { ...EMPTY_EVENT_DRAFT, placeId: place.id, city: place.city, address: place.address, latitude: String(place.latitude), longitude: String(place.longitude), pinned: true } });
          }}
        />
      )}
      {tab === "places" && placeFocus === null && (
        <>
          <button type="button" className="app-fin-withdraw" onClick={() => openPlaceForm({ mode: "create", draft: EMPTY_PLACE_DRAFT })}>
            <span className="app-fin-withdraw-plus" aria-hidden="true">
              +
            </span>
            Добавить место
          </button>
          <input className="app-profile-input" aria-label="Поиск" placeholder="Поиск" value={placeQuery} onChange={(change) => setPlaceQuery(change.target.value)} />
          <p className="app-gathering-hint">Место можно завести отдельно от события. Нажмите карточку — откроется управление местом.</p>
          <OrganizerListStatus state={places} emptyText="Пока нет мест. Площадка нужна, чтобы гости видели адрес." />
          {places.status === "ready" && places.items.filter((item) => item.title.toLowerCase().includes(placeQuery.trim().toLowerCase())).map((item) => <OrganizerPlaceCard key={item.id} item={item} publishing={publishingId === item.id} failed={publishErrorId === item.id} onPublish={() => publishPlace(item.id)} onOpen={() => setPlaceFocus(item.id)} />)}
        </>
      )}
    </section>
  );
}

export function OrganizerPage() {
  return <AppState>Панель организатора доступна через «Вход организатора» на стартовом экране.</AppState>;
}
