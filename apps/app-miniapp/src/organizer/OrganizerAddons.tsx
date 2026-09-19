// START_MODULE_CONTRACT
// PURPOSE: Organizer panel addons (#196/#199/#206): expandable per-event statistics (views/bookings/cancellations/paid + frozen sales report), promotion campaign management (list/create/paid stamp) and the organizer rating card shared with the event page.
// SCOPE: lazy loading on expand (stats and sales load together; promotions on open); the rating card renders nothing while loading, on error and when the API returns null (too few reviews — never show zeros); money values come from the API as-is (₽ formatting only, no arithmetic).
// DEPENDS: ../api/client.js (apiClient), @max-events/api-contracts (OrganizerRating, OrganizerEventStats, EventSalesReport, PromotionCampaign, CreatePromotionWrite), ../catalog/CatalogPage.js (CATEGORY_LABELS, formatStartsAt), ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - visitsCountLabel - ru plural form of «посещение» for the rating card
// - OrganizerRatingView - presentational rating card; renders nothing for null (too few reviews, loading or failed — #199)
// - EventOrganizerRatingCard - rating card container keyed by event (GET /events/:id/organizer-rating)
// - MyOrganizerRatingCard - rating card container keyed by the organizer user id (GET /organizers/:userId/rating)
// - EventStatsState - union of the stats+sales fetch states (loading / error / ready)
// - EventStatsView - presentational counters plus the sales summary and frozen sale rows
// - EventStatsSection - expandable container loading OrganizerEventStats + EventSalesReport on first open
// - PROMOTION_TYPE_LABELS - ru labels per promotion type
// - PROMOTION_STATUS_LABELS - ru labels per promotion status
// - PromotionDraft - promotion creation form draft (string fields; audience fields used only for target_collection)
// - EMPTY_PROMOTION_DRAFT - initial promotion form state
// - promotionDraftErrors - inline promotion validation errors (ru), empty list when ready (target_collection requires the audience)
// - toCreatePromotion - draft -> CreatePromotionWrite payload (call only when there are no errors)
// - PromotionCampaignRow - presentational campaign row with the manual «Отметить оплаченной» stamp for unpaid campaigns
// - PromotionForm - presentational promotion create form with inline errors; the audience fields render only for target_collection
// - PromotionSection - expandable promotion campaigns container: list, create form, paid stamp
// - OrganizerEventAddons - per-event organizer addon stack (stats + promotion)
// END_MODULE_MAP

import { useEffect, useState } from "react";
import { EventCategorySchema, type CreatePromotionWrite, type EventCategory, type EventSalesReport, type OrganizerEventStats, type OrganizerRating, type OrganizerRatingResponse, type PromotionCampaign, type PromotionStatus, type PromotionType } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { CATEGORY_LABELS, formatStartsAt } from "../catalog/CatalogPage";
import { AppButton, AppTitle } from "../ui/primitives";

/** ru plural of «посещение» for the rating card (1 посещение / 3 посещения / 12 посещений). */
export function visitsCountLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} посещение`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} посещения`;
  return `${count} посещений`;
}

export function OrganizerRatingView({ rating }: { rating: OrganizerRating | null }) {
  if (rating === null) return null;
  return (
    <section className="app-event">
      <div className="app-event-body">
        <AppTitle asChild>
          <h2 className="app-participation-title">Об организаторе</h2>
        </AppTitle>
        <ul className="app-participation-counters">
          <li>{rating.averageStars.toFixed(1)} ⭐</li>
          <li>{Math.round(rating.recommendPercent)}% рекомендуют</li>
          <li>{visitsCountLabel(rating.visitsCount)}</li>
          {rating.onTimePercent !== null && <li>{Math.round(rating.onTimePercent)}% вовремя</li>}
        </ul>
      </div>
    </section>
  );
}

/** Loads the organizer rating once per key; loading, errors and the too-few-reviews null all collapse to "no card" (the rating is auxiliary — never show zeros). */
function useOrganizerRating(key: string, load: () => Promise<OrganizerRatingResponse>): OrganizerRating | null {
  const [rating, setRating] = useState<OrganizerRating | null>(null);
  useEffect(() => {
    let alive = true;
    load().then(
      (response) => {
        if (alive) setRating(response.rating);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
    // ponytail: load is stable per key by construction at both call sites; depending on the key avoids a stale-closure ref wrapper
  }, [key]);
  return rating;
}

export function EventOrganizerRatingCard({ eventId }: { eventId: string }) {
  const rating = useOrganizerRating(eventId, () => apiClient.getEventOrganizerRating(eventId));
  return <OrganizerRatingView rating={rating} />;
}

export function MyOrganizerRatingCard({ userId }: { userId: string }) {
  const rating = useOrganizerRating(userId, () => apiClient.getOrganizerRating(userId));
  return <OrganizerRatingView rating={rating} />;
}

export type EventStatsState = { status: "loading" } | { status: "error" } | { status: "ready"; stats: OrganizerEventStats; report: EventSalesReport };

export function EventStatsView({ stats, report }: { stats: OrganizerEventStats; report: EventSalesReport }) {
  return (
    <div>
      <ul className="app-participation-counters">
        <li>Просмотры: {stats.views}</li>
        <li>Записи: {stats.bookings}</li>
        <li>Отмены: {stats.cancellations}</li>
        <li>Оплаченные записи: {stats.paidBookings}</li>
      </ul>
      <p className="app-card-subtitle">
        Продажи: {report.grossRub} ₽ · комиссия {report.commissionRub} ₽ · к выплате {report.netRub} ₽
      </p>
      {report.rows.length > 0 && (
        <ul className="app-participation-counters">
          {report.rows.map((row) => (
            <li key={row.paymentId}>
              {row.grossRub} ₽ · комиссия {row.commissionRub} ₽ · {row.netRub} ₽ к выплате
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EventStatsSection({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<EventStatsState | null>(null);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && state === null) {
      setState({ status: "loading" });
      Promise.all([apiClient.getOrganizerEventStats(eventId), apiClient.getEventSales(eventId)]).then(
        ([stats, report]) => setState({ status: "ready", stats, report }),
        () => setState({ status: "error" }),
      );
    }
  };

  return (
    <div>
      <AppButton size="small" tone="ghost" onClick={toggle}>
        {open ? "Скрыть статистику" : "Статистика"}
      </AppButton>
      {open && state?.status === "loading" && <p className="app-state">Загрузка…</p>}
      {open && state?.status === "error" && <p className="app-state app-state--error">Не удалось загрузить статистику.</p>}
      {open && state?.status === "ready" && <EventStatsView stats={state.stats} report={state.report} />}
    </div>
  );
}

export const PROMOTION_TYPE_LABELS: Record<PromotionType, string> = {
  boost: "Буст",
  banner: "Баннер",
  pin: "Пин на карте",
  target_collection: "Подборка по аудитории",
};

export const PROMOTION_STATUS_LABELS: Record<PromotionStatus, string> = {
  active: "Активна",
  completed: "Завершена",
};

export interface PromotionDraft {
  type: PromotionType;
  startsAt: string;
  endsAt: string;
  tariffCode: string;
  priceRub: string;
  minVisits: string;
  windowDays: string;
  category: EventCategory | "";
}

export const EMPTY_PROMOTION_DRAFT: PromotionDraft = { type: "boost", startsAt: "", endsAt: "", tariffCode: "", priceRub: "", minVisits: "2", windowDays: "30", category: "" };

export function promotionDraftErrors(draft: PromotionDraft): string[] {
  const errors: string[] = [];
  if (draft.startsAt === "") errors.push("Укажите начало кампании");
  if (draft.endsAt === "") errors.push("Укажите окончание кампании");
  if (draft.startsAt !== "" && draft.endsAt !== "" && new Date(draft.endsAt).getTime() <= new Date(draft.startsAt).getTime()) errors.push("Окончание должно быть позже начала");
  if (draft.tariffCode.trim() === "") errors.push("Укажите тариф");
  const price = draft.priceRub.trim() === "" ? Number.NaN : Number(draft.priceRub);
  if (!Number.isInteger(price) || price < 0) errors.push("Цена — целое число от 0");
  if (draft.type === "target_collection") {
    if (!Number.isInteger(Number(draft.minVisits)) || Number(draft.minVisits) < 1) errors.push("Минимум посещений — целое число от 1");
    if (!Number.isInteger(Number(draft.windowDays)) || Number(draft.windowDays) < 1) errors.push("Окно аудитории — целое число дней от 1");
  }
  return errors;
}

export function toCreatePromotion(draft: PromotionDraft): CreatePromotionWrite {
  return {
    type: draft.type,
    startsAt: new Date(draft.startsAt).toISOString(),
    endsAt: new Date(draft.endsAt).toISOString(),
    tariffCode: draft.tariffCode.trim(),
    priceRub: Number(draft.priceRub),
    audience: draft.type === "target_collection" ? { minVisits: Number(draft.minVisits), windowDays: Number(draft.windowDays), ...(draft.category === "" ? {} : { category: draft.category }) } : null,
  };
}

export function PromotionCampaignRow({ campaign, paying, onPaid }: { campaign: PromotionCampaign; paying: boolean; onPaid: () => void }) {
  return (
    <article className="app-card">
      <div className="app-card-body">
        <span className="app-card-title">
          {PROMOTION_TYPE_LABELS[campaign.type]} · {PROMOTION_STATUS_LABELS[campaign.status]}
        </span>
        <span className="app-card-subtitle">
          {formatStartsAt(campaign.startsAt)} — {formatStartsAt(campaign.endsAt)}
        </span>
        <span className="app-card-subtitle">
          {campaign.tariffCode} · {campaign.priceRub} ₽{campaign.paidAt !== null ? " · оплачена" : ""}
        </span>
        {campaign.audience !== null && (
          <span className="app-card-subtitle">
            Аудитория: от {campaign.audience.minVisits} посещений за {campaign.audience.windowDays} дн.{campaign.audience.category !== undefined ? ` · ${CATEGORY_LABELS[campaign.audience.category]}` : ""}
          </span>
        )}
        {campaign.paidAt === null && (
          <span className="app-card-subtitle">
            <AppButton size="small" tone="secondary" disabled={paying} onClick={onPaid}>
              {paying ? "Сохранение…" : "Отметить оплаченной"}
            </AppButton>
          </span>
        )}
      </div>
    </article>
  );
}

interface PromotionFormProps {
  draft: PromotionDraft;
  errors: string[];
  submitting: boolean;
  failed: boolean;
  onChange: (field: keyof PromotionDraft, value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function PromotionForm({ draft, errors, submitting, failed, onChange, onSubmit, onCancel }: PromotionFormProps) {
  return (
    <form
      className="app-profile-form"
      onSubmit={(submit) => {
        submit.preventDefault();
        onSubmit();
      }}
    >
      <select className="app-profile-input" aria-label="Тип продвижения" value={draft.type} onChange={(change) => onChange("type", change.target.value)}>
        {(Object.keys(PROMOTION_TYPE_LABELS) as PromotionType[]).map((type) => (
          <option key={type} value={type}>
            {PROMOTION_TYPE_LABELS[type]}
          </option>
        ))}
      </select>
      <input className="app-profile-input" type="datetime-local" aria-label="Начало кампании" value={draft.startsAt} onChange={(change) => onChange("startsAt", change.target.value)} />
      <input className="app-profile-input" type="datetime-local" aria-label="Окончание кампании" value={draft.endsAt} onChange={(change) => onChange("endsAt", change.target.value)} />
      <input className="app-profile-input" type="text" aria-label="Тариф" placeholder="Тариф (например, boost-7)" value={draft.tariffCode} onChange={(change) => onChange("tariffCode", change.target.value)} />
      <input className="app-profile-input" type="number" min={0} aria-label="Цена, ₽" placeholder="Цена, ₽" value={draft.priceRub} onChange={(change) => onChange("priceRub", change.target.value)} />
      {draft.type === "target_collection" && (
        <>
          <input className="app-profile-input" type="number" min={1} aria-label="Минимум посещений" placeholder="Минимум посещений" value={draft.minVisits} onChange={(change) => onChange("minVisits", change.target.value)} />
          <input className="app-profile-input" type="number" min={1} aria-label="Окно аудитории, дней" placeholder="Окно аудитории, дней" value={draft.windowDays} onChange={(change) => onChange("windowDays", change.target.value)} />
          <select className="app-profile-input" aria-label="Категория аудитории" value={draft.category} onChange={(change) => onChange("category", change.target.value)}>
            <option value="">Любая категория</option>
            {EventCategorySchema.options.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </>
      )}
      {errors.map((error) => (
        <p key={error} className="app-state app-state--error">
          {error}
        </p>
      ))}
      {failed && <p className="app-state app-state--error">Не удалось сохранить. Попробуйте ещё раз.</p>}
      <AppButton disabled={submitting} type="submit" stretched>
        {submitting ? "Сохранение…" : "Создать кампанию"}
      </AppButton>
      <AppButton type="button" tone="ghost" stretched onClick={onCancel}>
        Отмена
      </AppButton>
    </form>
  );
}

type PromotionListState = { status: "loading" } | { status: "error" } | { status: "ready"; items: PromotionCampaign[] };

export function PromotionSection({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<PromotionListState | null>(null);
  const [form, setForm] = useState<PromotionDraft | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && state === null) {
      setState({ status: "loading" });
      apiClient.listPromotions(eventId).then(
        (items) => setState({ status: "ready", items }),
        () => setState({ status: "error" }),
      );
    }
  };

  const submit = () => {
    if (form === null) return;
    const nextErrors = promotionDraftErrors(form);
    setErrors(nextErrors);
    if (nextErrors.length > 0) return;
    setSubmitting(true);
    setFailed(false);
    apiClient.createPromotion(eventId, toCreatePromotion(form)).then(
      (campaign) => {
        setState((current) => (current?.status === "ready" ? { status: "ready", items: [...current.items, campaign] } : current));
        setSubmitting(false);
        setForm(null);
      },
      () => {
        setSubmitting(false);
        setFailed(true);
      },
    );
  };

  const markPaid = (campaignId: string) => {
    setPayingId(campaignId);
    apiClient.markPromotionPaid(eventId, campaignId).then(
      (updated) => {
        setState((current) => (current?.status === "ready" ? { status: "ready", items: current.items.map((item) => (item.id === updated.id ? updated : item)) } : current));
        setPayingId(null);
      },
      () => setPayingId(null),
    );
  };

  return (
    <div>
      <AppButton size="small" tone="ghost" onClick={toggle}>
        {open ? "Скрыть продвижение" : "Продвижение"}
      </AppButton>
      {open && state?.status === "loading" && <p className="app-state">Загрузка…</p>}
      {open && state?.status === "error" && <p className="app-state app-state--error">Не удалось загрузить кампании.</p>}
      {open && state?.status === "ready" && (
        <>
          {state.items.length === 0 && form === null && <p className="app-state">Кампаний пока нет.</p>}
          {state.items.map((campaign) => (
            <PromotionCampaignRow key={campaign.id} campaign={campaign} paying={payingId === campaign.id} onPaid={() => markPaid(campaign.id)} />
          ))}
          {form === null ? (
            <AppButton
              tone="secondary"
              stretched
              onClick={() => {
                setErrors([]);
                setFailed(false);
                setForm(EMPTY_PROMOTION_DRAFT);
              }}
            >
              Новая кампания
            </AppButton>
          ) : (
            <PromotionForm draft={form} errors={errors} submitting={submitting} failed={failed} onChange={(field, value) => setForm((current) => (current === null ? current : { ...current, [field]: value }))} onSubmit={submit} onCancel={() => setForm(null)} />
          )}
        </>
      )}
    </div>
  );
}

export function OrganizerEventAddons({ eventId }: { eventId: string }) {
  return (
    <div className="app-card-body">
      <EventStatsSection eventId={eventId} />
      <PromotionSection eventId={eventId} />
    </div>
  );
}
