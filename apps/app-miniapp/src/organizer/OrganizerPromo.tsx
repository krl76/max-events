// START_MODULE_CONTRACT
// PURPOSE: Promotion section: running campaigns and the actions that start one (boost, chat mailing, promo code, refer-a-friend, early access). Charts live on the overview.
// SCOPE: Pure helpers plus OrganizerPromoView (presentational) and OrganizerPromo (container). Campaigns and promo codes are real endpoints per event, so the screen fans out over the organizer's own events.
// DEPENDS: react, @max-events/api-contracts (PromoCode, PromotionCampaign), ../api/client.js (apiClient, OrganizerEvent, OrganizerSummary, StatsPeriodQuery), ./OrganizerDashboard.js (OrganizerPromoIntent, TRAFFIC_SOURCE_LABELS, barHeights, formatCount), ../catalog/format.js (pluralRu), ../ui/primitives.js, ../ui/icons.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PROMOTION_ACTIONS - the five actions, in the order the screen lists them
// - promotionTimeLeft - «Осталось 14 ч» / «Осталось 3 дня» / «Завершена»
// - CampaignRow - one «Активные кампании» row, whichever of the three kinds it came from
// - campaignRows - promotions, referral campaigns and promo codes merged into the rows the screen lists
// - PROMOTION_TYPE_LABELS - ru label per promotion type
// - OrganizerPromoView - presentational: running campaigns and the action form
// - OrganizerPromo - container: the summary, the campaigns across own events, creating one and downloading the report
// END_MODULE_MAP

import { useCallback, useEffect, useRef, useState } from "react";
import type { PromoCampaign, PromoCode, PromotionCampaign, PromotionType } from "@max-events/api-contracts";
import { apiClient, type OrganizerEvent } from "../api/client";
import { formatStartsAt, pluralRu } from "../catalog/format";
import { EventPicker } from "../ui/EventPicker";
import { ActionIcon, type ActionIconName } from "../ui/icons";
import { pictured } from "../ui/photos";
import { AppButton, AppMedia, AppSkeletonList, AppState } from "../ui/primitives";
import { type OrganizerPromoIntent } from "./OrganizerDashboard";

export { PROMO_PERIODS, formatDelta, periodQueryFor, salesCsv } from "./OrganizerDashboard";

export const PROMOTION_ACTIONS: Array<{ intent: OrganizerPromoIntent; label: string; aria: string; icon: ActionIconName; dark?: boolean }> = [
  { intent: "boost", label: "Лента", aria: "Поднять в ленте", icon: "trend" },
  { intent: "target_collection", label: "Рассылка", aria: "Рассылка в чаты", icon: "megaphone" },
  { intent: "promocode", label: "Промокод", aria: "Промокод", icon: "ticket" },
  { intent: "referral", label: "Друг", aria: "Приведи друга", icon: "users" },
  { intent: "early_access", label: "Ранний", aria: "Ранний доступ", icon: "clock" },
];

export function promotionTimeLeft(endsAt: string, now: Date = new Date()): string {
  const ms = new Date(endsAt).getTime() - now.getTime();
  if (ms <= 0) return "Завершена";
  const hours = Math.round(ms / 3_600_000);
  if (hours < 48) return `Осталось ${hours} ч`;
  const days = Math.round(hours / 24);
  return `Осталось ${days} ${pluralRu(days, "день", "дня", "дней")}`;
}

export const PROMOTION_TYPE_LABELS: Record<PromotionType, string> = { boost: "Поднятие в ленте", banner: "Баннер", pin: "Закрепление", target_collection: "Рассылка в чаты" };

export interface CampaignRow {
  id: string;
  eventId: string;
  icon: ActionIconName;
  accent: boolean;
  title: string;
  note: string;
  /** 0..100 of the campaign's own window; null for a promo code, which has no clock. */
  progress: number | null;
}

/**
 * Three endpoints, one list: the design shows «Поднятие в ленте» and «Промокод» side by side, and the
 * viewer has no reason to care which table each came from.
 */
export function campaignRows(promotions: PromotionCampaign[], campaigns: PromoCampaign[], codes: PromoCode[], events: OrganizerEvent[], now: Date = new Date()): CampaignRow[] {
  const titleOf = (eventId: string) => events.find((item) => item.id === eventId)?.title ?? "Событие";
  const rows: CampaignRow[] = [];
  for (const promotion of promotions) {
    const span = new Date(promotion.endsAt).getTime() - new Date(promotion.startsAt).getTime();
    const gone = now.getTime() - new Date(promotion.startsAt).getTime();
    rows.push({
      id: promotion.id,
      eventId: promotion.eventId,
      icon: promotion.type === "target_collection" ? "megaphone" : "trend",
      accent: true,
      title: `${PROMOTION_TYPE_LABELS[promotion.type]} · ${titleOf(promotion.eventId)}`,
      note: `${promotionTimeLeft(promotion.endsAt, now)} · ${promotion.priceRub === 0 ? "без оплаты" : `${promotion.priceRub} ₽`}`,
      progress: span <= 0 ? 100 : Math.min(Math.max(Math.round((gone / span) * 100), 0), 100),
    });
  }
  for (const campaign of campaigns) {
    rows.push({ id: campaign.id, eventId: campaign.eventId, icon: "friends", accent: true, title: `${campaign.title} · ${titleOf(campaign.eventId)}`, note: `Код ${campaign.code} · сработал ${campaign.fulfillmentCount} ${pluralRu(campaign.fulfillmentCount, "раз", "раза", "раз")}`, progress: null });
  }
  for (const code of codes) {
    rows.push({ id: code.id, eventId: code.eventId, icon: "tag", accent: false, title: `Промокод ${code.code}`, note: `Использован ${code.redeemedCount} ${pluralRu(code.redeemedCount, "раз", "раза", "раз")}${code.maxRedemptions === null ? "" : ` из ${code.maxRedemptions}`}`, progress: null });
  }
  return rows;
}

type CampaignKind = OrganizerPromoIntent;

interface NewCampaignDraft {
  eventId: string;
  kind: CampaignKind;
  code: string;
  title: string;
  opensAt: string;
}

interface OrganizerPromoViewProps {
  organizationName: string;
  events: OrganizerEvent[];
  rows: CampaignRow[];
  loaded: boolean;
  draft: NewCampaignDraft | null;
  busy: boolean;
  notice: string | null;
  failed: string | null;
  onOpenDraft: (kind: CampaignKind) => void;
  onDraft: (draft: NewCampaignDraft) => void;
  onCreate: () => void;
  onCancelDraft: () => void;
  onOpenEvent: (eventId: string) => void;
}

export function OrganizerPromoView({ organizationName, events, rows, loaded, draft, busy, notice, failed, onOpenDraft, onDraft, onCreate, onCancelDraft, onOpenEvent }: OrganizerPromoViewProps) {
  const month = new Date().toLocaleDateString("ru-RU", { month: "long" });
  const [pickingEvent, setPickingEvent] = useState(false);
  const bound = draft === null ? null : (events.find((item) => item.id === draft.eventId) ?? null);
  return (
    <section className="app-gathering" aria-label="Продвижение">
      <p className="app-gathering-hint">
        {organizationName} · {month}
      </p>
      <p className="app-gathering-hint">Пять способов привести гостей. Сначала выберите способ, потом событие.</p>
        <div className="app-search-tools">
          {PROMOTION_ACTIONS.map((action) => {
            const on = draft?.kind === action.intent;
            return (
              <button key={action.intent} type="button" className="app-search-tool" aria-label={action.aria} aria-pressed={on} disabled={events.length === 0} onClick={() => onOpenDraft(action.intent)}>
                <span className={on ? "app-search-tool-bubble app-search-tool-bubble--dark" : "app-search-tool-bubble"}>
                  <ActionIcon name={action.icon} size={20} />
                </span>
                {action.label}
              </button>
            );
          })}
        </div>
        <h2 className="app-section-title">Уже запущено</h2>
        {!loaded && <AppSkeletonList rows={2} />}
        {loaded && rows.length === 0 && <p className="app-gathering-hint">Кампаний пока нет — запустите первую выше.</p>}
        {rows.length > 0 && (
          <div className="app-set-group">
            {rows.map((row) => (
              <button key={row.id} type="button" className="app-set-row" onClick={() => onOpenEvent(row.eventId)}>
                <span className="app-set-row-text">
                  <span className="app-set-row-title">{row.title}</span>
                  <span className="app-set-row-hint">{row.note}</span>
                </span>
                <ActionIcon name="chevron" size={16} strokeWidth={2.6} />
              </button>
            ))}
          </div>
        )}
        {notice !== null && <p className="app-org-notice">{notice}</p>}
        {failed !== null && <AppState error>{failed}</AppState>}
        {draft !== null && (
          <form
            className="app-org-campaign-form"
            onSubmit={(submit) => {
              submit.preventDefault();
              onCreate();
            }}
          >
            <div className="app-post-compose-rows">
              <div className="app-post-compose-row app-post-compose-row--event">
                <button type="button" className="app-post-compose-row-hit" onClick={() => setPickingEvent(true)}>
                  {bound === null ? (
                    <span className="app-post-compose-row-media" aria-hidden="true" />
                  ) : (
                    <AppMedia category={bound.category} src={pictured(bound.id, bound.coverUrl)} className="app-post-compose-thumb" />
                  )}
                  <span className="app-post-compose-row-text">
                    <span className="app-post-compose-row-title">{bound === null ? "Привязать событие" : bound.title}</span>
                    <span className="app-post-compose-row-note">{bound === null ? "Фото, дата и место — в окне выбора" : formatStartsAt(bound.startsAt)}</span>
                  </span>
                  {bound === null && (
                    <span className="app-post-compose-row-chevron" aria-hidden="true">
                      <ActionIcon name="chevron" size={16} strokeWidth={2.6} />
                    </span>
                  )}
                </button>
                {bound !== null && (
                  <button type="button" className="app-post-compose-row-drop" aria-label="Отвязать событие" onClick={() => onDraft({ ...draft, eventId: "" })}>
                    <ActionIcon name="close" size={18} strokeWidth={2.6} />
                  </button>
                )}
              </div>
              {pickingEvent && (
                <EventPicker
                  title="Событие"
                  events={events}
                  selectedId={draft.eventId === "" ? null : draft.eventId}
                  onPick={(event) => {
                    onDraft({ ...draft, eventId: event.id });
                    setPickingEvent(false);
                  }}
                  onClose={() => setPickingEvent(false)}
                />
              )}
            </div>
            {(draft.kind === "promocode" || draft.kind === "referral") && (
              <label className="app-org-field">
                <span className="app-org-field-label">Код</span>
                <input className="app-org-field-input" value={draft.code} placeholder="ОСЕНЬ20" onChange={(change) => onDraft({ ...draft, code: change.target.value })} />
              </label>
            )}
            {draft.kind === "referral" && (
              <label className="app-org-field">
                <span className="app-org-field-label">Название акции</span>
                <input className="app-org-field-input" value={draft.title} placeholder="Приведи друга" onChange={(change) => onDraft({ ...draft, title: change.target.value })} />
              </label>
            )}
            {draft.kind === "early_access" && (
              <label className="app-org-field">
                <span className="app-org-field-label">Запись откроется</span>
                <input className="app-org-field-input" type="datetime-local" aria-label="Запись откроется" value={draft.opensAt} onChange={(change) => onDraft({ ...draft, opensAt: change.target.value })} />
              </label>
            )}
            <div className="app-org-actions">
              <AppButton stretched type="submit" disabled={busy}>
                {busy ? "Создаём…" : "Создать"}
              </AppButton>
              <AppButton stretched type="button" onClick={onCancelDraft}>
                Отмена
              </AppButton>
            </div>
          </form>
        )}
    </section>
  );
}

const DAY_MS = 86_400_000;

export function OrganizerPromo({ organizationName, intent, eventId, onOpenEvent }: { organizationName: string; intent: OrganizerPromoIntent | null; eventId: string | null; onOpenEvent: (eventId: string) => void }) {
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState<NewCampaignDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);
  const appliedFocus = useRef("");

  useEffect(() => {
    let alive = true;
    apiClient.listOrganizerEvents().then(
      async (items) => {
        if (!alive) return;
        setEvents(items);
        const fetched = await Promise.all(items.map((item) => Promise.all([apiClient.listPromotions(item.id).catch(() => []), apiClient.listCampaigns(item.id).catch(() => []), apiClient.listOrganizerPromos(item.id).catch(() => [])])));
        if (!alive) return;
        setLoaded(true);
        setRows(
          campaignRows(
            fetched.flatMap((row) => row[0]),
            fetched.flatMap((row) => row[1]),
            fetched.flatMap((row) => row[2]),
            items,
          ),
        );
      },
      () => {
        if (!alive) return;
        setLoaded(true);
        setFailed("Не удалось загрузить кампании.");
      },
    );
    return () => {
      alive = false;
    };
  }, [reloads]);

  const openDraft = useCallback(
    (kind: CampaignKind, preferredEventId?: string) => {
      setNotice(null);
      setFailed(null);
      const preferred = preferredEventId ?? eventId ?? undefined;
      const chosen = preferred !== undefined && events.some((item) => item.id === preferred) ? preferred : (events[0]?.id ?? "");
      setDraft({ eventId: chosen, kind, code: "", title: "Приведи друга", opensAt: "" });
    },
    [events, eventId],
  );

  useEffect(() => {
    if (intent === null || events.length === 0) return;
    const key = `${intent}:${eventId ?? ""}`;
    if (appliedFocus.current === key) return;
    appliedFocus.current = key;
    openDraft(intent, eventId ?? undefined);
  }, [intent, eventId, events.length, openDraft]);

  const create = () => {
    if (draft === null || draft.eventId === "") return;
    setBusy(true);
    setFailed(null);
    const now = Date.now();
    const request =
      draft.kind === "promocode"
        ? apiClient.createOrganizerPromo(draft.eventId, { code: draft.code.trim() })
        : draft.kind === "referral"
          ? apiClient.createCampaign(draft.eventId, { type: "refer_a_friend", code: draft.code.trim(), title: draft.title.trim() || "Приведи друга" })
          : draft.kind === "early_access"
            ? apiClient.setOrganizerEarlyAccess(draft.eventId, new Date(draft.opensAt).toISOString())
            : draft.kind === "boost"
              ? apiClient.createPromotion(draft.eventId, { type: "boost", startsAt: new Date(now).toISOString(), endsAt: new Date(now + DAY_MS).toISOString(), tariffCode: "boost-24h", priceRub: 0 })
              : apiClient.createPromotion(draft.eventId, { type: "target_collection", startsAt: new Date(now).toISOString(), endsAt: new Date(now + 7 * DAY_MS).toISOString(), tariffCode: "target-7d", priceRub: 0, audience: { minVisits: 1, windowDays: 90 } });
    request.then(
      () => {
        setBusy(false);
        setDraft(null);
        setNotice(draft.kind === "early_access" ? "Ранний доступ сохранён" : "Кампания запущена");
        setReloads((value) => value + 1);
      },
      () => {
        setBusy(false);
        setFailed("Не удалось запустить. Проверьте код и дату — код может быть занят.");
      },
    );
  };

  return <OrganizerPromoView organizationName={organizationName} events={events} rows={rows} loaded={loaded} draft={draft} busy={busy} notice={notice} failed={failed} onOpenDraft={openDraft} onDraft={setDraft} onCreate={create} onCancelDraft={() => setDraft(null)} onOpenEvent={onOpenEvent} />;
}
