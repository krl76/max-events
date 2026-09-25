// START_MODULE_CONTRACT
// PURPOSE: «Создание события» (макет, экран 43): cover, name, date and time, category, venue, seats, price, description, the two switches and the weekly series, with «Опубликовать» in the header.
// SCOPE: The draft shape and its pure helpers plus OrganizerEventFormView (presentational) and OrganizerEventForm (container). Publishing runs create -> options -> publish; the switches and the series live on the options sub-resource, because the Event contract has no field for them.
// DEPENDS: react, @max-events/api-contracts (CreateEvent, EventCategory, EventCategorySchema), ../api/client.js (apiClient, OrganizerEvent, OrganizerEventOptions, OrganizerPlace, UpdateOrganizerEventOptions), ../catalog/format.js (CATEGORY_LABELS), ../ui/primitives.js, ../ui/icons.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OrganizerEventFormDraft - the экран 43 form: the contract event fields as strings plus the four switches that live outside the contract
// - EMPTY_ORGANIZER_EVENT_FORM - a new event: today's date, afisha, registration in the mini-app
// - organizerEventFormErrors - inline ru validation, empty list when the draft is ready to publish
// - organizerEventFormToCreate - draft -> CreateEvent (call only when there are no errors)
// - organizerEventFormOptions - draft -> the options patch (waitlist, in-app registration, external link, weekly series)
// - organizerEventFormFrom - prefill from an existing event and its options (edit mode)
// - formatFormDate - «Вс, 20 сен» for the date card
// - formatFormTime - «09:00 – 10:30», or just the start when there is no end
// - weeklySeriesUntil - the date a weekly series runs to: the last day of the month after the first date
// - weeklySeriesNote - «Создаст серию до конца октября»
// - OrganizerEventFormView - presentational: the header, the cover, the field cards, the switches and the footnote
// - OrganizerEventForm - container: loads the organizer places, saves the draft, publishes
// END_MODULE_MAP

import { useEffect, useState, type ReactNode } from "react";
import { EventCategorySchema, type CreateEvent, type EventCategory } from "@max-events/api-contracts";
import { apiClient, type OrganizerEvent, type OrganizerEventOptions, type OrganizerPlace, type UpdateOrganizerEventOptions } from "../api/client";
import { CATEGORY_LABELS } from "../catalog/format";
import { ActionIcon } from "../ui/icons";
import { AppButton, AppState } from "../ui/primitives";

export interface OrganizerEventFormDraft {
  title: string;
  category: EventCategory;
  city: string;
  placeId: string;
  /** YYYY-MM-DD; the design shows the date and the two times as three separate cards. */
  date: string;
  startTime: string;
  endTime: string;
  capacity: string;
  price: string;
  paymentUrl: string;
  description: string;
  waitlistEnabled: boolean;
  registrationInApp: boolean;
  externalUrl: string;
  repeatWeekly: boolean;
}

export const EMPTY_ORGANIZER_EVENT_FORM: OrganizerEventFormDraft = {
  title: "",
  category: "afisha",
  city: "",
  placeId: "",
  date: "",
  startTime: "",
  endTime: "",
  capacity: "",
  price: "",
  paymentUrl: "",
  description: "",
  waitlistEnabled: true,
  registrationInApp: true,
  externalUrl: "",
  repeatWeekly: false,
};

function localInstant(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString();
}

export function organizerEventFormErrors(draft: OrganizerEventFormDraft): string[] {
  const errors: string[] = [];
  if (draft.title.trim() === "") errors.push("Укажите название события");
  if (draft.city.trim() === "") errors.push("Укажите город");
  if (draft.date === "") errors.push("Укажите дату");
  if (draft.startTime === "") errors.push("Укажите время начала");
  if (draft.date !== "" && draft.startTime !== "" && draft.endTime !== "" && draft.endTime <= draft.startTime) errors.push("Окончание не может быть раньше начала");
  const price = draft.price.trim() === "" ? null : Number(draft.price);
  if (price !== null && (!Number.isInteger(price) || price < 0)) errors.push("Цена — целое число от 0");
  // The contract's own invariant: a paid event must carry a payment link, a free one must not.
  if (price !== null && price > 0 && draft.paymentUrl.trim() === "") errors.push("Для платного события нужна ссылка на оплату");
  if (draft.capacity.trim() !== "" && (!Number.isInteger(Number(draft.capacity)) || Number(draft.capacity) < 1)) errors.push("Вместимость — целое число от 1");
  if (draft.waitlistEnabled && draft.capacity.trim() === "") errors.push("Лист ожидания нужен только там, где есть предел мест");
  if (!draft.registrationInApp && draft.externalUrl.trim() === "") errors.push("Укажите ссылку на регистрацию на вашем сайте");
  return errors;
}

export function organizerEventFormToCreate(draft: OrganizerEventFormDraft): CreateEvent {
  const price = draft.price.trim() === "" ? null : Number(draft.price);
  const paid = price !== null && price > 0;
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    category: draft.category,
    city: draft.city.trim(),
    placeId: draft.placeId === "" ? null : draft.placeId,
    startsAt: localInstant(draft.date, draft.startTime),
    endsAt: draft.endTime === "" ? null : localInstant(draft.date, draft.endTime),
    isPaid: paid,
    priceRub: price,
    paymentUrl: paid ? draft.paymentUrl.trim() : null,
    capacity: draft.capacity.trim() === "" ? null : Number(draft.capacity),
    // The form has no cover picker yet: a missing cover falls back to the category gradient everywhere it is drawn.
    coverUrl: null,
  };
}

export function organizerEventFormOptions(draft: OrganizerEventFormDraft): UpdateOrganizerEventOptions {
  return {
    waitlistEnabled: draft.waitlistEnabled,
    registrationInApp: draft.registrationInApp,
    externalUrl: draft.registrationInApp ? null : draft.externalUrl.trim(),
    recurrence: draft.repeatWeekly && draft.date !== "" ? { rule: "weekly", until: weeklySeriesUntil(draft.date) } : null,
  };
}

function localDateParts(iso: string): { date: string; time: string } {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return { date: "", time: "" };
  const pad = (value: number) => String(value).padStart(2, "0");
  return { date: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`, time: `${pad(at.getHours())}:${pad(at.getMinutes())}` };
}

export function organizerEventFormFrom(item: OrganizerEvent, options: OrganizerEventOptions | null): OrganizerEventFormDraft {
  const start = localDateParts(item.startsAt);
  const end = item.endsAt === null ? { date: "", time: "" } : localDateParts(item.endsAt);
  return {
    title: item.title,
    category: item.category,
    city: item.city,
    placeId: item.placeId ?? "",
    date: start.date,
    startTime: start.time,
    endTime: end.time,
    capacity: item.capacity === null ? "" : String(item.capacity),
    price: item.priceRub === null ? "" : String(item.priceRub),
    paymentUrl: item.paymentUrl ?? "",
    description: item.description,
    waitlistEnabled: options?.waitlistEnabled ?? item.capacity !== null,
    registrationInApp: options?.registrationInApp ?? true,
    externalUrl: options?.externalUrl ?? "",
    repeatWeekly: options?.recurrence !== null && options?.recurrence !== undefined,
  };
}

/** «Вс, 20 сен» — the value of the «Дата» card; an empty draft says so instead of rendering an invalid date. */
export function formatFormDate(date: string): string {
  if (date === "") return "Не выбрана";
  const at = new Date(`${date}T00:00`);
  if (Number.isNaN(at.getTime())) return "Не выбрана";
  return at.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" });
}

export function formatFormTime(startTime: string, endTime: string): string {
  if (startTime === "") return "Не выбрано";
  return endTime === "" ? startTime : `${startTime} – ${endTime}`;
}

/**
 * A weekly series runs to the end of the month after the one it starts in — «до конца октября» for a
 * September event. Nothing in the contract stores a recurrence, so the horizon is the screen's promise,
 * not a server rule, and it is spelled out under the switch rather than left to be discovered later.
 */
export function weeklySeriesUntil(date: string): string {
  const at = new Date(`${date}T00:00`);
  if (Number.isNaN(at.getTime())) return "";
  const last = new Date(at.getFullYear(), at.getMonth() + 2, 0);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`;
}

export function weeklySeriesNote(date: string): string {
  const until = weeklySeriesUntil(date);
  if (until === "") return "Сначала выберите дату";
  // «до конца октября», не «октябрь»: родительный падеж месяца даёт только формат с числом, из него и берём.
  const [, month] = new Date(`${until}T00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }).split(" ");
  return `Создаст серию до конца ${month}`;
}

function FieldCard({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return (
    <label className="app-org-field">
      <span className="app-org-field-label">{label}</span>
      {children}
      {note !== undefined && <span className="app-org-field-note">{note}</span>}
    </label>
  );
}

function SwitchRow({ title, note, on, onToggle }: { title: string; note: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="app-org-switch-row">
      <span className="app-org-switch-text">
        <span className="app-org-switch-title">{title}</span>
        <span className="app-org-switch-note">{note}</span>
      </span>
      <button type="button" className={on ? "app-set-switch app-set-switch--on" : "app-set-switch"} role="switch" aria-checked={on} aria-label={title} onClick={onToggle}>
        <span className="app-set-switch-knob" />
      </button>
    </div>
  );
}

interface OrganizerEventFormViewProps {
  draft: OrganizerEventFormDraft;
  organizationName: string;
  places: OrganizerPlace[];
  errors: string[];
  published: boolean;
  submitting: boolean;
  failed: boolean;
  onChange: <K extends keyof OrganizerEventFormDraft>(field: K, value: OrganizerEventFormDraft[K]) => void;
  onPublish: () => void;
  onSaveDraft: () => void;
  onBack: () => void;
}

export function OrganizerEventFormView({ draft, organizationName, places, errors, published, submitting, failed, onChange, onPublish, onSaveDraft, onBack }: OrganizerEventFormViewProps) {
  const price = draft.price.trim() === "" ? 0 : Number(draft.price);
  return (
    <section className="app-org-screen" aria-label="Новое событие">
      <div className="app-org-topbar">
        <button type="button" className="app-org-round app-org-round--back" aria-label="Назад" onClick={onBack}>
          <ActionIcon name="chevron" size={18} strokeWidth={2.6} />
        </button>
        <span className="app-org-topbar-text">
          <span className="app-org-topbar-title">{draft.title.trim() === "" ? "Новое событие" : draft.title}</span>
          <span className="app-org-topbar-sub">
            {published ? "Опубликовано" : "Черновик"} · {organizationName}
          </span>
        </span>
        <button type="button" className="app-org-topbar-action" disabled={submitting} onClick={onPublish}>
          {submitting ? "Сохраняем…" : published ? "Сохранить" : "Опубликовать"}
        </button>
      </div>
      <div className="app-org-form">
        <div className={`app-org-cover app-media--${draft.category}`}>
          <span className="app-org-cover-blob" aria-hidden="true" />
          <span className="app-org-cover-chips">
            {/* Фотографий в продукте нет: обложка — градиент категории, поэтому «заменить» её значит сменить категорию. */}
            <span className="app-org-cover-chip">Обложка · {CATEGORY_LABELS[draft.category]}</span>
            <span className="app-org-cover-chip">
              <ActionIcon name="camera" size={14} strokeWidth={2.2} /> Градиент категории
            </span>
          </span>
        </div>
        <FieldCard label="Название">
          <input className="app-org-field-input" type="text" placeholder="Йога на набережной" value={draft.title} onChange={(change) => onChange("title", change.target.value)} />
        </FieldCard>
        <div className="app-org-fields-row">
          <FieldCard label="Дата" note={formatFormDate(draft.date)}>
            <input className="app-org-field-input" type="date" value={draft.date} onChange={(change) => onChange("date", change.target.value)} />
          </FieldCard>
          <FieldCard label="Время" note={formatFormTime(draft.startTime, draft.endTime)}>
            <span className="app-org-field-times">
              <input className="app-org-field-input" type="time" aria-label="Начало" value={draft.startTime} onChange={(change) => onChange("startTime", change.target.value)} />
              <input className="app-org-field-input" type="time" aria-label="Окончание" value={draft.endTime} onChange={(change) => onChange("endTime", change.target.value)} />
            </span>
          </FieldCard>
        </div>
        <FieldCard label="Категория" note="Влияет на подборки и ленту">
          <select className="app-org-field-input" value={draft.category} onChange={(change) => onChange("category", change.target.value as EventCategory)}>
            {EventCategorySchema.options.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </FieldCard>
        <FieldCard label="Место" note={draft.placeId === "" ? "Точки на карте не будет — только город" : "Точка на карте выбрана"}>
          <select className="app-org-field-input" aria-label="Площадка" value={draft.placeId} onChange={(change) => onChange("placeId", change.target.value)}>
            <option value="">Без площадки</option>
            {places.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
          <input className="app-org-field-input" type="text" aria-label="Город" placeholder="Город" value={draft.city} onChange={(change) => onChange("city", change.target.value)} />
        </FieldCard>
        <div className="app-org-fields-row">
          <FieldCard label="Мест" note={draft.waitlistEnabled ? "Лист ожидания включён" : "Без листа ожидания"}>
            <input className="app-org-field-input" type="number" min={1} placeholder="Без предела" value={draft.capacity} onChange={(change) => onChange("capacity", change.target.value)} />
          </FieldCard>
          <FieldCard label="Цена" note={price > 0 ? "Нужна ссылка на оплату" : "Бесплатно · можно указать донат"}>
            <input className="app-org-field-input" type="number" min={0} placeholder="0" value={draft.price} onChange={(change) => onChange("price", change.target.value)} />
          </FieldCard>
        </div>
        {price > 0 && (
          <FieldCard label="Ссылка на оплату">
            <input className="app-org-field-input" type="url" placeholder="https://" value={draft.paymentUrl} onChange={(change) => onChange("paymentUrl", change.target.value)} />
          </FieldCard>
        )}
        <FieldCard label="Описание">
          <textarea className="app-org-field-input app-org-field-area" rows={3} placeholder="Что будет на событии" value={draft.description} onChange={(change) => onChange("description", change.target.value)} />
        </FieldCard>
        <SwitchRow title="Регистрация в мини-приложении" note="Иначе только ссылка на ваш сайт" on={draft.registrationInApp} onToggle={() => onChange("registrationInApp", !draft.registrationInApp)} />
        {!draft.registrationInApp && (
          <FieldCard label="Ссылка на регистрацию">
            <input className="app-org-field-input" type="url" placeholder="https://" value={draft.externalUrl} onChange={(change) => onChange("externalUrl", change.target.value)} />
          </FieldCard>
        )}
        <SwitchRow title="Лист ожидания" note="Когда мест не осталось, запись идёт в очередь" on={draft.waitlistEnabled} onToggle={() => onChange("waitlistEnabled", !draft.waitlistEnabled)} />
        <SwitchRow title="Повторять каждую неделю" note={weeklySeriesNote(draft.date)} on={draft.repeatWeekly} onToggle={() => onChange("repeatWeekly", !draft.repeatWeekly)} />
        {errors.map((error) => (
          <p key={error} className="app-state app-state--error">
            {error}
          </p>
        ))}
        {failed && <AppState error>Не удалось сохранить. Попробуйте ещё раз.</AppState>}
        <p className="app-org-form-note">После публикации событие попадёт в ленту и поиск, а подписчикам площадки уйдёт уведомление.</p>
        {!published && (
          <AppButton tone="ghost" stretched disabled={submitting} onClick={onSaveDraft}>
            Сохранить черновик
          </AppButton>
        )}
      </div>
    </section>
  );
}

export function OrganizerEventForm({ organizationName, eventId = null, onBack, onPublished }: { organizationName: string; eventId?: string | null; onBack: () => void; onPublished: (eventId: string) => void }) {
  const [draft, setDraft] = useState<OrganizerEventFormDraft>(EMPTY_ORGANIZER_EVENT_FORM);
  const [places, setPlaces] = useState<OrganizerPlace[]>([]);
  const [savedId, setSavedId] = useState<string | null>(eventId);
  const [published, setPublished] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    apiClient.listOrganizerPlaces().then(
      (items) => {
        if (alive) setPlaces(items);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (eventId === null) return;
    let alive = true;
    Promise.all([apiClient.listOrganizerEvents(), apiClient.getOrganizerEventOptions(eventId).catch(() => null)]).then(
      ([items, options]) => {
        const found = items.find((item) => item.id === eventId);
        if (!alive || !found) return;
        setDraft(organizerEventFormFrom(found, options));
        setPublished(!found.draft);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [eventId]);

  /** Одна дорога для обеих кнопок: создать или обновить, затем записать переключатели, затем — по желанию — опубликовать. */
  const save = (publish: boolean) => {
    const nextErrors = organizerEventFormErrors(draft);
    setErrors(nextErrors);
    if (nextErrors.length > 0) return;
    setSubmitting(true);
    setFailed(false);
    const payload = organizerEventFormToCreate(draft);
    const saved = savedId === null ? apiClient.createOrganizerEvent(payload) : apiClient.updateOrganizerEvent(savedId, { title: payload.title, startsAt: payload.startsAt, endsAt: payload.endsAt, isPaid: payload.isPaid, priceRub: payload.priceRub, paymentUrl: payload.paymentUrl, capacity: payload.capacity });
    saved
      .then(async (item: OrganizerEvent) => {
        setSavedId(item.id);
        await apiClient.updateOrganizerEventOptions(item.id, organizerEventFormOptions(draft));
        if (!publish) return item;
        const live = await apiClient.publishOrganizerEvent(item.id);
        setPublished(true);
        return live;
      })
      .then(
        (item) => {
          setSubmitting(false);
          if (publish) onPublished(item.id);
        },
        () => {
          setSubmitting(false);
          setFailed(true);
        },
      );
  };

  return <OrganizerEventFormView draft={draft} organizationName={organizationName} places={places} errors={errors} published={published} submitting={submitting} failed={failed} onChange={(field, value) => setDraft((current) => ({ ...current, [field]: value }))} onPublish={() => save(true)} onSaveDraft={() => save(false)} onBack={onBack} />;
}
