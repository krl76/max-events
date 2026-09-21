// START_MODULE_CONTRACT
// PURPOSE: Organizer panel: own events/places with draft badges, draft creation forms, publish and minimal edit (event title/time/price/capacity, place title/address/city/coords).
// SCOPE: Data via apiClient.listOrganizerEvents/createOrganizerEvent/updateOrganizerEvent/publishOrganizerEvent and the place twins; drafts flagged from the raw published field (returned by toEventDto/toPlaceDto; a missing flag reads as published); inline validation errors; mutations applied to local list state.
// DEPENDS: ../api/client.js (apiClient, OrganizerEvent, OrganizerPlace, UpdateOrganizerEvent, UpdateOrganizerPlace), ../catalog/CatalogPage.js (CATEGORY_LABELS, formatStartsAt), ./OrganizerAddons.js (MyOrganizerRatingCard, OrganizerEventAddons), ../ui/primitives.js, @max-events/api-contracts (CreateEvent, CreatePlace, EventCategory, EventCategorySchema, PlaceCategory, PlaceCategorySchema), ../ui/theme.css
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
// - OrganizerPanel - panel keyed by the organization id: events/places tabs, data loading, create/publish/edit mutations; renders the own-rating card and per-event stats/promotion addons from ./OrganizerAddons.js (#196/#199/#206)
// - OrganizerPage - legacy route stub: the panel lives in the organizer space (./OrganizerSpace.js) behind the organizer login
// END_MODULE_MAP

import { useEffect, useState } from "react";
import { EventCategorySchema, PlaceCategorySchema, type CreateEvent, type CreatePlace, type EventCategory, type PlaceCategory } from "@max-events/api-contracts";
import { apiClient, type OrganizerEvent, type OrganizerPlace, type UpdateOrganizerEvent } from "../api/client";
import { CATEGORY_LABELS, formatStartsAt } from "../catalog/CatalogPage";
import { MyOrganizerRatingCard, OrganizerEventAddons } from "./OrganizerAddons";
import { AppButton, AppChip, AppState } from "../ui/primitives";

export const PLACE_CATEGORY_LABELS: Record<PlaceCategory, string> = {
  park: "Парк",
  museum: "Музей",
  food: "Еда",
  sport: "Спорт",
  other: "Другое",
};

export interface EventDraft {
  title: string;
  category: EventCategory;
  city: string;
  startsAt: string;
  endsAt: string;
  price: string;
  paymentUrl: string;
  capacity: string;
}

export interface PlaceDraft {
  title: string;
  address: string;
  city: string;
  category: PlaceCategory;
  latitude: string;
  longitude: string;
}

export const EMPTY_EVENT_DRAFT: EventDraft = { title: "", category: "afisha", city: "", startsAt: "", endsAt: "", price: "", paymentUrl: "", capacity: "" };

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
  if (price !== null && price > 0 && draft.paymentUrl.trim() === "") errors.push("Для платного события нужна ссылка на оплату");
  if (draft.capacity.trim() !== "" && (!Number.isInteger(Number(draft.capacity)) || Number(draft.capacity) < 1)) errors.push("Вместимость — целое число от 1");
  return errors;
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
    description: "",
    category: draft.category,
    city: draft.city.trim(),
    placeId: null,
    startsAt: new Date(draft.startsAt).toISOString(),
    endsAt: draft.endsAt === "" ? null : new Date(draft.endsAt).toISOString(),
    isPaid: paid,
    priceRub: price,
    paymentUrl: paid ? draft.paymentUrl.trim() : null,
    capacity: draft.capacity.trim() === "" ? null : Number(draft.capacity),
  };
}

export function toCreatePlace(draft: PlaceDraft): CreatePlace {
  return { title: draft.title.trim(), address: draft.address.trim(), city: draft.city.trim(), category: draft.category, latitude: Number(draft.latitude), longitude: Number(draft.longitude) };
}

export function toEventPatch(draft: EventDraft): UpdateOrganizerEvent {
  const created = toCreateEvent(draft);
  return { title: created.title, startsAt: created.startsAt, endsAt: created.endsAt, isPaid: created.isPaid, priceRub: created.priceRub, paymentUrl: created.paymentUrl, capacity: created.capacity };
}

export function eventDraftFrom(item: OrganizerEvent): EventDraft {
  return {
    title: item.title,
    category: item.category,
    city: item.city,
    startsAt: toLocalInput(item.startsAt),
    endsAt: item.endsAt === null ? "" : toLocalInput(item.endsAt),
    price: item.priceRub === null ? "" : String(item.priceRub),
    paymentUrl: item.paymentUrl ?? "",
    capacity: item.capacity === null ? "" : String(item.capacity),
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

export function OrganizerEventCard({ item, publishing, failed, onPublish, onEdit }: { item: OrganizerEvent; publishing: boolean; failed: boolean; onPublish: () => void; onEdit: () => void }) {
  return (
    <article className="app-card">
      <div className="app-card-body">
        <span className="app-card-title">
          {item.draft && <span className="app-micro-badge">Черновик</span>} {item.title}
        </span>
        <span className="app-card-subtitle">
          {formatStartsAt(item.startsAt)} · {item.city}
        </span>
        <span className="app-card-subtitle">
          {item.isPaid && item.priceRub !== null ? `${item.priceRub} ₽` : "Бесплатно"}
          {item.capacity !== null ? ` · до ${item.capacity} мест` : ""}
        </span>
        {failed && <AppState error>Не удалось опубликовать. Попробуйте ещё раз.</AppState>}
        <span className="app-card-subtitle">
          {item.draft && (
            <AppButton size="small" disabled={publishing} onClick={onPublish}>
              {publishing ? "Публикация…" : "Опубликовать"}
            </AppButton>
          )}{" "}
          <AppButton size="small" tone="secondary" onClick={onEdit}>
            Изменить
          </AppButton>
        </span>
      </div>
    </article>
  );
}

export function OrganizerPlaceCard({ item, publishing, failed, onPublish, onEdit }: { item: OrganizerPlace; publishing: boolean; failed: boolean; onPublish: () => void; onEdit: () => void }) {
  return (
    <article className="app-card">
      <div className="app-card-body">
        <span className="app-card-title">
          {item.draft && <span className="app-micro-badge">Черновик</span>} {item.title}
        </span>
        <span className="app-card-subtitle">
          {item.address} · {item.city}
        </span>
        <span className="app-card-subtitle">{PLACE_CATEGORY_LABELS[item.category]}</span>
        {failed && <AppState error>Не удалось опубликовать. Попробуйте ещё раз.</AppState>}
        <span className="app-card-subtitle">
          {item.draft && (
            <AppButton size="small" disabled={publishing} onClick={onPublish}>
              {publishing ? "Публикация…" : "Опубликовать"}
            </AppButton>
          )}{" "}
          <AppButton size="small" tone="secondary" onClick={onEdit}>
            Изменить
          </AppButton>
        </span>
      </div>
    </article>
  );
}

interface EventDraftFormProps {
  draft: EventDraft;
  errors: string[];
  submitting: boolean;
  failed: boolean;
  submitLabel: string;
  onChange: (field: keyof EventDraft, value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function EventDraftForm({ draft, errors, submitting, failed, submitLabel, onChange, onSubmit, onCancel }: EventDraftFormProps) {
  return (
    <form
      className="app-profile-form"
      onSubmit={(submit) => {
        submit.preventDefault();
        onSubmit();
      }}
    >
      <input className="app-profile-input" type="text" aria-label="Название" placeholder="Название события" value={draft.title} onChange={(change) => onChange("title", change.target.value)} />
      <select className="app-profile-input" aria-label="Категория" value={draft.category} onChange={(change) => onChange("category", change.target.value)}>
        {EventCategorySchema.options.map((category) => (
          <option key={category} value={category}>
            {CATEGORY_LABELS[category]}
          </option>
        ))}
      </select>
      <input className="app-profile-input" type="text" aria-label="Город" placeholder="Город" value={draft.city} onChange={(change) => onChange("city", change.target.value)} />
      <input className="app-profile-input" type="datetime-local" aria-label="Начало" value={draft.startsAt} onChange={(change) => onChange("startsAt", change.target.value)} />
      <input className="app-profile-input" type="datetime-local" aria-label="Окончание (необязательно)" value={draft.endsAt} onChange={(change) => onChange("endsAt", change.target.value)} />
      <input className="app-profile-input" type="number" min={0} aria-label="Цена, ₽ (пусто — бесплатно)" placeholder="Цена, ₽ (пусто — бесплатно)" value={draft.price} onChange={(change) => onChange("price", change.target.value)} />
      {Number(draft.price) > 0 && <input className="app-profile-input" type="url" aria-label="Ссылка на оплату" placeholder="Ссылка на оплату" value={draft.paymentUrl} onChange={(change) => onChange("paymentUrl", change.target.value)} />}
      <input className="app-profile-input" type="number" min={1} aria-label="Вместимость (необязательно)" placeholder="Вместимость (необязательно)" value={draft.capacity} onChange={(change) => onChange("capacity", change.target.value)} />
      {errors.map((error) => (
        <p key={error} className="app-state app-state--error">
          {error}
        </p>
      ))}
      {failed && <AppState error>Не удалось сохранить. Попробуйте ещё раз.</AppState>}
      <AppButton disabled={submitting} type="submit" stretched>
        {submitting ? "Сохранение…" : submitLabel}
      </AppButton>
      <AppButton type="button" tone="ghost" stretched onClick={onCancel}>
        Отмена
      </AppButton>
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
      <input className="app-profile-input" type="text" aria-label="Название" placeholder="Название места" value={draft.title} onChange={(change) => onChange("title", change.target.value)} />
      <input className="app-profile-input" type="text" aria-label="Адрес" placeholder="Адрес" value={draft.address} onChange={(change) => onChange("address", change.target.value)} />
      <input className="app-profile-input" type="text" aria-label="Город" placeholder="Город" value={draft.city} onChange={(change) => onChange("city", change.target.value)} />
      <select className="app-profile-input" aria-label="Категория" value={draft.category} onChange={(change) => onChange("category", change.target.value)}>
        {PlaceCategorySchema.options.map((category) => (
          <option key={category} value={category}>
            {PLACE_CATEGORY_LABELS[category]}
          </option>
        ))}
      </select>
      <input className="app-profile-input" type="text" inputMode="decimal" aria-label="Широта" placeholder="Широта" value={draft.latitude} onChange={(change) => onChange("latitude", change.target.value)} />
      <input className="app-profile-input" type="text" inputMode="decimal" aria-label="Долгота" placeholder="Долгота" value={draft.longitude} onChange={(change) => onChange("longitude", change.target.value)} />
      {errors.map((error) => (
        <p key={error} className="app-state app-state--error">
          {error}
        </p>
      ))}
      {failed && <AppState error>Не удалось сохранить. Попробуйте ещё раз.</AppState>}
      <AppButton disabled={submitting} type="submit" stretched>
        {submitting ? "Сохранение…" : submitLabel}
      </AppButton>
      <AppButton type="button" tone="ghost" stretched onClick={onCancel}>
        Отмена
      </AppButton>
    </form>
  );
}

type EventFormState = { mode: "create"; draft: EventDraft } | { mode: "edit"; id: string; draft: EventDraft } | null;
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

export function OrganizerPanel({ organizationId }: { organizationId: string }) {
  const [tab, setTab] = useState<"events" | "places">("events");
  const [events, setEvents] = useState<OrganizerListState<OrganizerEvent>>({ status: "loading" });
  const [places, setPlaces] = useState<OrganizerListState<OrganizerPlace>>({ status: "loading" });
  const [eventForm, setEventForm] = useState<EventFormState>(null);
  const [placeForm, setPlaceForm] = useState<PlaceFormState>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishErrorId, setPublishErrorId] = useState<string | null>(null);

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
    setEventForm(next);
  };

  const openPlaceForm = (next: PlaceFormState) => {
    setErrors([]);
    setFailed(false);
    setEventForm(null);
    setPlaceForm(next);
  };

  const submitEvent = () => {
    if (eventForm === null) return;
    const nextErrors = eventDraftErrors(eventForm.draft);
    setErrors(nextErrors);
    if (nextErrors.length > 0) return;
    setSubmitting(true);
    setFailed(false);
    const request = eventForm.mode === "create" ? apiClient.createOrganizerEvent(toCreateEvent(eventForm.draft)) : apiClient.updateOrganizerEvent(eventForm.id, toEventPatch(eventForm.draft));
    request.then(
      (item) => {
        setEvents((current) => (current.status === "ready" ? { status: "ready", items: sortEvents(upsert(current.items, item)) } : current));
        setSubmitting(false);
        setEventForm(null);
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

  const publishEvent = (id: string) => {
    setPublishingId(id);
    setPublishErrorId(null);
    apiClient.publishOrganizerEvent(id).then(
      (item) => {
        setEvents((current) => (current.status === "ready" ? { status: "ready", items: upsert(current.items, item) } : current));
        setPublishingId(null);
      },
      () => {
        setPublishingId(null);
        setPublishErrorId(id);
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

  return (
    <section className="app-gathering">
      <p className="app-gathering-hint">Черновики видны только вам — опубликуйте, когда всё готово</p>
      <MyOrganizerRatingCard organizationId={organizationId} />
      <div className="app-filters-chips">
        <AppChip pressed={tab === "events"} onClick={() => setTab("events")}>
          События
        </AppChip>{" "}
        <AppChip pressed={tab === "places"} onClick={() => setTab("places")}>
          Места
        </AppChip>
      </div>
      {tab === "events" && (
        <>
          <OrganizerListStatus state={events} emptyText="Пока нет событий — создайте первое." />
          {events.status === "ready" &&
            events.items.map((item) =>
              eventForm?.mode === "edit" && eventForm.id === item.id ? null : (
                <div key={item.id}>
                  <OrganizerEventCard item={item} publishing={publishingId === item.id} failed={publishErrorId === item.id} onPublish={() => publishEvent(item.id)} onEdit={() => openEventForm({ mode: "edit", id: item.id, draft: eventDraftFrom(item) })} />
                  <OrganizerEventAddons eventId={item.id} bookingOpensAt={item.bookingOpensAt} />
                </div>
              ),
            )}
          {eventForm === null ? (
            <AppButton tone="secondary" stretched onClick={() => openEventForm({ mode: "create", draft: EMPTY_EVENT_DRAFT })}>
              Новое событие
            </AppButton>
          ) : (
            <EventDraftForm draft={eventForm.draft} errors={errors} submitting={submitting} failed={failed} submitLabel={eventForm.mode === "create" ? "Создать черновик" : "Сохранить"} onChange={(field, value) => setEventForm((current) => (current === null ? current : { ...current, draft: { ...current.draft, [field]: value } }))} onSubmit={submitEvent} onCancel={() => openEventForm(null)} />
          )}
        </>
      )}
      {tab === "places" && (
        <>
          <OrganizerListStatus state={places} emptyText="Пока нет мест — создайте первое." />
          {places.status === "ready" && places.items.map((item) => (placeForm?.mode === "edit" && placeForm.id === item.id ? null : <OrganizerPlaceCard key={item.id} item={item} publishing={publishingId === item.id} failed={publishErrorId === item.id} onPublish={() => publishPlace(item.id)} onEdit={() => openPlaceForm({ mode: "edit", id: item.id, draft: placeDraftFrom(item) })} />))}
          {placeForm === null ? (
            <AppButton tone="secondary" stretched onClick={() => openPlaceForm({ mode: "create", draft: EMPTY_PLACE_DRAFT })}>
              Новое место
            </AppButton>
          ) : (
            <PlaceDraftForm draft={placeForm.draft} errors={errors} submitting={submitting} failed={failed} submitLabel={placeForm.mode === "create" ? "Создать черновик" : "Сохранить"} onChange={(field, value) => setPlaceForm((current) => (current === null ? current : { ...current, draft: { ...current.draft, [field]: value } }))} onSubmit={submitPlace} onCancel={() => openPlaceForm(null)} />
          )}
        </>
      )}
    </section>
  );
}

export function OrganizerPage() {
  return <AppState>Панель организатора доступна через «Вход организатора» на стартовом экране.</AppState>;
}
