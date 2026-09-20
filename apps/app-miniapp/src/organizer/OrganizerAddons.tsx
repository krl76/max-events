// START_MODULE_CONTRACT
// PURPOSE: Organizer panel addons (#196/#199/#206/#372): expandable per-event statistics (views/bookings/cancellations/paid + frozen sales report), promotion campaign management (list/create/paid stamp), promocode and refer-a-friend/special-offer campaign management (list/create), early-access window, and the organizer rating card shared with the event page.
// SCOPE: lazy loading on expand (stats and sales load together; promotions, promocodes and campaigns on open); the rating card renders nothing while loading, on error and when the API returns null (too few reviews — never show zeros); money values come from the API as-is (₽ formatting only, no arithmetic).
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
// - EventStatsSection - expandable container loading OrganizerEventStats + EventSalesReport on first open; re-open after an error retries the load
// - LazyListState - shared list fetch state union (loading / error / ready items) used by the expandable addon sections
// - ExpandableSection - shared expandable container: toggle button, loading/error app states, ready content via render children
// - PROMOTION_TYPE_LABELS - ru labels per promotion type
// - PROMOTION_STATUS_LABELS - ru labels per promotion status
// - PromotionDraft - promotion creation form draft (string fields; audience fields used only for target_collection)
// - EMPTY_PROMOTION_DRAFT - initial promotion form state
// - promotionDraftErrors - inline promotion validation errors (ru), empty list when ready (target_collection requires the audience)
// - toCreatePromotion - draft -> CreatePromotionWrite payload (call only when there are no errors)
// - PromotionCampaignRow - presentational campaign row with the manual «Отметить оплаченной» stamp for unpaid campaigns
// - PromotionForm - presentational promotion create form with inline errors; the audience fields render only for target_collection
// - PromotionSection - expandable promotion campaigns container: list, create form, paid stamp; re-open after an error retries the load
// - PROMO_CAMPAIGN_TYPE_LABELS - ru labels per promo campaign type (#372)
// - PromoDraft - promocode creation form draft (string fields; limit/expiry optional) (#372)
// - EMPTY_PROMO_DRAFT - initial promocode form state (#372)
// - promoDraftErrors - inline promocode validation errors (ru), empty list when ready (#372)
// - toCreatePromo - draft -> CreatePromoCodeWrite payload (call only when there are no errors) (#372)
// - PromoCodeRow - presentational promocode row: the code itself, redemptions and expiry (#372)
// - PromoForm - presentational promocode create form with inline errors (#372)
// - PromoCodeSection - expandable promocodes container: list + create (#372)
// - CampaignDraft - refer-a-friend/special-offer creation form draft (#372)
// - EMPTY_CAMPAIGN_DRAFT - initial promo campaign form state (#372)
// - campaignDraftErrors - inline promo campaign validation errors (ru) (#372)
// - toCreateCampaign - draft -> CreatePromoCampaignWrite payload (#372)
// - PromoCampaignRow - presentational promo campaign row: type, the shareable code, title, status, fulfillment counters (#372)
// - CampaignForm - presentational promo campaign create form with inline errors (#372)
// - CampaignSection - expandable refer-a-friend/special-offer container: list + create; the list shows the campaign codes (#372)
// - EarlyAccessSection - bookingOpensAt window editor (current value + set) (#372)
// - OrganizerEventAddons - per-event organizer addon stack (early access + stats + promocodes + promo campaigns + promotion)
// END_MODULE_MAP

import { useEffect, useState, type ReactNode } from "react";
import { EventCategorySchema, type CreatePromoCampaignWrite, type CreatePromoCodeWrite, type CreatePromotionWrite, type EventCategory, type EventSalesReport, type OrganizerEventStats, type OrganizerRating, type OrganizerRatingResponse, type PromoCampaign, type PromoCampaignType, type PromoCode, type PromotionCampaign, type PromotionStatus, type PromotionType } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { CATEGORY_LABELS, formatStartsAt } from "../catalog/CatalogPage";
import { AppButton, AppTitle, AppState } from "../ui/primitives";

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
          <h2 className="app-section-title">Об организаторе</h2>
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
    if (next && (state === null || state.status === "error")) {
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
      {open && state?.status === "loading" && <AppState>Загрузка…</AppState>}
      {open && state?.status === "error" && <AppState error>Не удалось загрузить статистику.</AppState>}
      {open && state?.status === "ready" && <EventStatsView stats={state.stats} report={state.report} />}
    </div>
  );
}

export type LazyListState<T> = { status: "loading" } | { status: "error" } | { status: "ready"; items: T[] };

/** Shared expand/lazy-load state for the addon list sections: first open (or re-open after an error) fetches the list, re-open after an error retries the load. */
function useLazyList<T>(load: () => Promise<T[]>) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LazyListState<T> | null>(null);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && (state === null || state.status === "error")) {
      setState({ status: "loading" });
      load().then(
        (items) => setState({ status: "ready", items }),
        () => setState({ status: "error" }),
      );
    }
  };
  const append = (item: T) => setState((current) => (current?.status === "ready" ? { status: "ready", items: [...current.items, item] } : current));
  return { open, toggle, state, setState, append };
}

export function ExpandableSection<T>({ label, openLabel, errorText, list, children }: { label: string; openLabel: string; errorText: string; list: { open: boolean; toggle: () => void; state: LazyListState<T> | null }; children: (items: T[]) => ReactNode }) {
  return (
    <div>
      <AppButton size="small" tone="ghost" onClick={list.toggle}>
        {list.open ? openLabel : label}
      </AppButton>
      {list.open && list.state?.status === "loading" && <AppState>Загрузка…</AppState>}
      {list.open && list.state?.status === "error" && <AppState error>{errorText}</AppState>}
      {list.open && list.state?.status === "ready" && children(list.state.items)}
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
      {failed && <AppState error>Не удалось сохранить. Попробуйте ещё раз.</AppState>}
      <AppButton disabled={submitting} type="submit" stretched>
        {submitting ? "Сохранение…" : "Создать кампанию"}
      </AppButton>
      <AppButton type="button" tone="ghost" stretched onClick={onCancel}>
        Отмена
      </AppButton>
    </form>
  );
}

export function PromotionSection({ eventId }: { eventId: string }) {
  const list = useLazyList(() => apiClient.listPromotions(eventId));
  const [form, setForm] = useState<PromotionDraft | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  const submit = () => {
    if (form === null) return;
    const nextErrors = promotionDraftErrors(form);
    setErrors(nextErrors);
    if (nextErrors.length > 0) return;
    setSubmitting(true);
    setFailed(false);
    apiClient.createPromotion(eventId, toCreatePromotion(form)).then(
      (campaign) => {
        list.append(campaign);
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
        list.setState((current) => (current?.status === "ready" ? { status: "ready", items: current.items.map((item) => (item.id === updated.id ? updated : item)) } : current));
        setPayingId(null);
      },
      () => setPayingId(null),
    );
  };

  return (
    <ExpandableSection list={list} label="Продвижение" openLabel="Скрыть продвижение" errorText="Не удалось загрузить кампании.">
      {(items) => (
        <>
          {items.length === 0 && form === null && <AppState>Кампаний пока нет.</AppState>}
          {items.map((campaign) => (
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
    </ExpandableSection>
  );
}

export const PROMO_CAMPAIGN_TYPE_LABELS: Record<PromoCampaignType, string> = {
  refer_a_friend: "Приведи друга",
  special_offer: "Спецпредложение",
};

export interface PromoDraft {
  code: string;
  maxRedemptions: string;
  expiresAt: string;
}

export const EMPTY_PROMO_DRAFT: PromoDraft = { code: "", maxRedemptions: "", expiresAt: "" };

export function promoDraftErrors(draft: PromoDraft): string[] {
  const errors: string[] = [];
  const code = draft.code.trim();
  if (code === "" || code.length > 40) errors.push("Укажите код (до 40 символов)");
  if (draft.maxRedemptions !== "" && (!Number.isInteger(Number(draft.maxRedemptions)) || Number(draft.maxRedemptions) < 1)) errors.push("Лимит — целое число от 1 или пусто");
  return errors;
}

export function toCreatePromo(draft: PromoDraft): CreatePromoCodeWrite {
  return {
    code: draft.code.trim(),
    ...(draft.maxRedemptions === "" ? {} : { maxRedemptions: Number(draft.maxRedemptions) }),
    ...(draft.expiresAt === "" ? {} : { expiresAt: new Date(draft.expiresAt).toISOString() }),
  };
}

export function PromoCodeRow({ code }: { code: PromoCode }) {
  return (
    <article className="app-card">
      <div className="app-card-body">
        <span className="app-card-title">{code.code}</span>
        <span className="app-card-subtitle">
          Использований: {code.redeemedCount}
          {code.maxRedemptions === null ? " · без лимита" : ` из ${code.maxRedemptions}`}
        </span>
        {code.expiresAt !== null && <span className="app-card-subtitle">До {formatStartsAt(code.expiresAt)}</span>}
      </div>
    </article>
  );
}

interface PromoFormProps {
  draft: PromoDraft;
  errors: string[];
  submitting: boolean;
  failed: boolean;
  onChange: (field: keyof PromoDraft, value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function PromoForm({ draft, errors, submitting, failed, onChange, onSubmit, onCancel }: PromoFormProps) {
  return (
    <form
      className="app-profile-form"
      onSubmit={(submit) => {
        submit.preventDefault();
        onSubmit();
      }}
    >
      <input className="app-profile-input" type="text" aria-label="Код промокода" placeholder="Код промокода" value={draft.code} onChange={(change) => onChange("code", change.target.value)} />
      <input className="app-profile-input" type="number" min={1} aria-label="Лимит применений" placeholder="Лимит применений (необязательно)" value={draft.maxRedemptions} onChange={(change) => onChange("maxRedemptions", change.target.value)} />
      <input className="app-profile-input" type="datetime-local" aria-label="Действует до" value={draft.expiresAt} onChange={(change) => onChange("expiresAt", change.target.value)} />
      {errors.map((error) => (
        <p key={error} className="app-state app-state--error">
          {error}
        </p>
      ))}
      {failed && <AppState error>Не удалось сохранить. Попробуйте ещё раз.</AppState>}
      <AppButton disabled={submitting} type="submit" stretched>
        {submitting ? "Сохранение…" : "Создать промокод"}
      </AppButton>
      <AppButton type="button" tone="ghost" stretched onClick={onCancel}>
        Отмена
      </AppButton>
    </form>
  );
}

export function PromoCodeSection({ eventId }: { eventId: string }) {
  const list = useLazyList(() => apiClient.listOrganizerPromos(eventId));
  const [form, setForm] = useState<PromoDraft | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  const submit = () => {
    if (form === null) return;
    const nextErrors = promoDraftErrors(form);
    setErrors(nextErrors);
    if (nextErrors.length > 0) return;
    setSubmitting(true);
    setFailed(false);
    apiClient.createOrganizerPromo(eventId, toCreatePromo(form)).then(
      (code) => {
        list.append(code);
        setSubmitting(false);
        setForm(null);
      },
      () => {
        setSubmitting(false);
        setFailed(true);
      },
    );
  };

  return (
    <ExpandableSection list={list} label="Промокоды" openLabel="Скрыть промокоды" errorText="Не удалось загрузить промокоды.">
      {(items) => (
        <>
          {items.length === 0 && form === null && <AppState>Промокодов пока нет.</AppState>}
          {items.map((code) => (
            <PromoCodeRow key={code.id} code={code} />
          ))}
          {form === null ? (
            <AppButton
              tone="secondary"
              stretched
              onClick={() => {
                setErrors([]);
                setFailed(false);
                setForm(EMPTY_PROMO_DRAFT);
              }}
            >
              Новый промокод
            </AppButton>
          ) : (
            <PromoForm draft={form} errors={errors} submitting={submitting} failed={failed} onChange={(field, value) => setForm((current) => (current === null ? current : { ...current, [field]: value }))} onSubmit={submit} onCancel={() => setForm(null)} />
          )}
        </>
      )}
    </ExpandableSection>
  );
}

export interface CampaignDraft {
  type: PromoCampaignType;
  code: string;
  title: string;
}

export const EMPTY_CAMPAIGN_DRAFT: CampaignDraft = { type: "refer_a_friend", code: "", title: "" };

export function campaignDraftErrors(draft: CampaignDraft): string[] {
  const errors: string[] = [];
  const code = draft.code.trim();
  if (code === "" || code.length > 40) errors.push("Укажите код (до 40 символов)");
  if (draft.title.trim() === "") errors.push("Укажите название акции");
  return errors;
}

export function toCreateCampaign(draft: CampaignDraft): CreatePromoCampaignWrite {
  return { type: draft.type, code: draft.code.trim(), title: draft.title.trim() };
}

export function PromoCampaignRow({ campaign }: { campaign: PromoCampaign }) {
  return (
    <article className="app-card">
      <div className="app-card-body">
        <span className="app-card-title">
          {PROMO_CAMPAIGN_TYPE_LABELS[campaign.type]} · {PROMOTION_STATUS_LABELS[campaign.status]}
        </span>
        <span className="app-card-subtitle">Код акции: {campaign.code}</span>
        <span className="app-card-subtitle">{campaign.title}</span>
        <span className="app-card-subtitle">
          Выполнений: {campaign.fulfillmentCount}
          {campaign.maxFulfillments === null ? "" : ` из ${campaign.maxFulfillments}`}
        </span>
      </div>
    </article>
  );
}

interface CampaignFormProps {
  draft: CampaignDraft;
  errors: string[];
  submitting: boolean;
  failed: boolean;
  onChange: (field: keyof CampaignDraft, value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function CampaignForm({ draft, errors, submitting, failed, onChange, onSubmit, onCancel }: CampaignFormProps) {
  return (
    <form
      className="app-profile-form"
      onSubmit={(submit) => {
        submit.preventDefault();
        onSubmit();
      }}
    >
      <select className="app-profile-input" aria-label="Тип акции" value={draft.type} onChange={(change) => onChange("type", change.target.value)}>
        {(Object.keys(PROMO_CAMPAIGN_TYPE_LABELS) as PromoCampaignType[]).map((type) => (
          <option key={type} value={type}>
            {PROMO_CAMPAIGN_TYPE_LABELS[type]}
          </option>
        ))}
      </select>
      <input className="app-profile-input" type="text" aria-label="Код акции" placeholder="Код акции" value={draft.code} onChange={(change) => onChange("code", change.target.value)} />
      <input className="app-profile-input" type="text" aria-label="Название акции" placeholder="Название акции" value={draft.title} onChange={(change) => onChange("title", change.target.value)} />
      {errors.map((error) => (
        <p key={error} className="app-state app-state--error">
          {error}
        </p>
      ))}
      {failed && <AppState error>Не удалось сохранить. Попробуйте ещё раз.</AppState>}
      <AppButton disabled={submitting} type="submit" stretched>
        {submitting ? "Сохранение…" : "Создать акцию"}
      </AppButton>
      <AppButton type="button" tone="ghost" stretched onClick={onCancel}>
        Отмена
      </AppButton>
    </form>
  );
}

export function CampaignSection({ eventId }: { eventId: string }) {
  const list = useLazyList(() => apiClient.listCampaigns(eventId));
  const [form, setForm] = useState<CampaignDraft | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  const submit = () => {
    if (form === null) return;
    const nextErrors = campaignDraftErrors(form);
    setErrors(nextErrors);
    if (nextErrors.length > 0) return;
    setSubmitting(true);
    setFailed(false);
    apiClient.createCampaign(eventId, toCreateCampaign(form)).then(
      (campaign) => {
        list.append(campaign);
        setSubmitting(false);
        setForm(null);
      },
      () => {
        setSubmitting(false);
        setFailed(true);
      },
    );
  };

  return (
    <ExpandableSection list={list} label="Акции" openLabel="Скрыть акции" errorText="Не удалось загрузить акции.">
      {(items) => (
        <>
          {items.length === 0 && form === null && <AppState>Акций пока нет.</AppState>}
          {items.map((campaign) => (
            <PromoCampaignRow key={campaign.id} campaign={campaign} />
          ))}
          {form === null ? (
            <AppButton
              tone="secondary"
              stretched
              onClick={() => {
                setErrors([]);
                setFailed(false);
                setForm(EMPTY_CAMPAIGN_DRAFT);
              }}
            >
              Новая акция
            </AppButton>
          ) : (
            <CampaignForm draft={form} errors={errors} submitting={submitting} failed={failed} onChange={(field, value) => setForm((current) => (current === null ? current : { ...current, [field]: value }))} onSubmit={submit} onCancel={() => setForm(null)} />
          )}
        </>
      )}
    </ExpandableSection>
  );
}

export function EarlyAccessSection({ eventId, bookingOpensAt }: { eventId: string; bookingOpensAt: string | null }) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const save = () => {
    if (value === "") return;
    setSaving(true);
    setFailed(false);
    apiClient.setOrganizerEarlyAccess(eventId, new Date(value).toISOString()).then(
      ({ bookingOpensAt }) => {
        setSaving(false);
        setSaved(bookingOpensAt);
      },
      () => {
        setSaving(false);
        setFailed(true);
      },
    );
  };

  const current = saved ?? bookingOpensAt;
  return (
    <div>
      <AppButton size="small" tone="ghost" onClick={() => setValue(current === null ? "" : current.slice(0, 16))}>
        Ранний доступ
      </AppButton>
      {value !== "" && (
        <form
          className="app-profile-form"
          onSubmit={(submit) => {
            submit.preventDefault();
            save();
          }}
        >
          <input className="app-profile-input" type="datetime-local" aria-label="Запись откроется" value={value} onChange={(change) => setValue(change.target.value)} />
          {current !== null && <p className="app-card-subtitle">Сейчас: запись откроется {formatStartsAt(current)}</p>}
          {failed && <AppState error>Не удалось сохранить.</AppState>}
          <AppButton disabled={saving} type="submit" stretched>
            {saving ? "Сохранение…" : "Сохранить"}
          </AppButton>
        </form>
      )}
    </div>
  );
}

export function OrganizerEventAddons({ eventId, bookingOpensAt }: { eventId: string; bookingOpensAt: string | null }) {
  return (
    <div className="app-card-body">
      <EarlyAccessSection eventId={eventId} bookingOpensAt={bookingOpensAt} />
      <EventStatsSection eventId={eventId} />
      <PromoCodeSection eventId={eventId} />
      <CampaignSection eventId={eventId} />
      <PromotionSection eventId={eventId} />
    </div>
  );
}
