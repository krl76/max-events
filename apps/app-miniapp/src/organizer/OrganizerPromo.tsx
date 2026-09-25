// START_MODULE_CONTRACT
// PURPOSE: «Промо и отчёты» (макет, экран 48): the period tiles, the bookings-by-day chart, the traffic split, the active campaigns and the month report.
// SCOPE: Pure helpers plus OrganizerPromoView (presentational) and OrganizerPromo (container). Campaigns and promo codes are real endpoints per event, so the screen fans out over the organizer's own events; the report is built here from the sales rows, because the backend has no export of its own.
// DEPENDS: react, @max-events/api-contracts (PromoCode, PromotionCampaign), ../api/client.js (apiClient, OrganizerEvent, OrganizerSummary, StatsPeriodQuery), ./OrganizerDashboard.js (OrganizerPromoIntent, TRAFFIC_SOURCE_LABELS, barHeights, formatCount), ../catalog/format.js (pluralRu), ../ui/primitives.js, ../ui/icons.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PROMO_PERIODS - the windows the period pill offers, in design order (30 дней is the default)
// - WEEKDAY_LABELS - пн…вс under the chart
// - periodQueryFor - a window of N days back from now as a from/to query
// - formatDelta - «+18% к прошлому периоду», «—» when there is nothing to compare with
// - promotionTimeLeft - «Осталось 14 ч» / «Осталось 3 дня» / «Завершена»
// - CampaignRow - one «Активные кампании» row, whichever of the three kinds it came from
// - campaignRows - promotions, referral campaigns and promo codes merged into the rows the screen lists
// - PROMOTION_TYPE_LABELS - ru label per promotion type
// - salesCsv - the month report: one CSV line per settled sale, plus the totals line
// - OrganizerPromoView - presentational: header with the period pill, tiles, chart, sources, campaigns, actions
// - OrganizerPromo - container: the summary, the campaigns across own events, creating one and downloading the report
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import type { EventSalesReport, PromoCampaign, PromoCode, PromotionCampaign, PromotionType } from "@max-events/api-contracts";
import { apiClient, type OrganizerEvent, type OrganizerSummary, type StatsPeriodQuery } from "../api/client";
import { pluralRu } from "../catalog/format";
import { ActionIcon, type ActionIconName } from "../ui/icons";
import { AppButton, AppSkeletonList, AppState } from "../ui/primitives";
import { TRAFFIC_SOURCE_LABELS, barHeights, formatCount, type OrganizerPromoIntent } from "./OrganizerDashboard";

export const PROMO_PERIODS: Array<{ days: number; label: string }> = [
  { days: 7, label: "7 дней" },
  { days: 30, label: "30 дней" },
  { days: 90, label: "90 дней" },
];

export const WEEKDAY_LABELS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"] as const;

export function periodQueryFor(days: number, now: Date = new Date()): StatsPeriodQuery {
  return { from: new Date(now.getTime() - days * 86_400_000).toISOString(), to: now.toISOString() };
}

export function formatDelta(percent: number | null): string {
  if (percent === null) return "—";
  return `${percent > 0 ? "+" : ""}${percent}% к прошлому периоду`;
}

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

/** The month report the design offers as a file: the backend has a sales endpoint but no export of its own. */
export function salesCsv(reports: Array<{ title: string; report: EventSalesReport }>): string {
  const lines = ["событие;платёж;бронь;сумма, ₽;комиссия, ₽;к выплате, ₽;дата"];
  let gross = 0;
  let commission = 0;
  let net = 0;
  for (const { title, report } of reports) {
    for (const row of report.rows) {
      lines.push([title, row.paymentId, row.bookingId, row.grossRub, row.commissionRub, row.netRub, row.commissionFixedAt].join(";"));
    }
    gross += report.grossRub;
    commission += report.commissionRub;
    net += report.netRub;
  }
  lines.push(["ИТОГО", "", "", gross, commission, net, ""].join(";"));
  return lines.join("\n");
}

type CampaignKind = OrganizerPromoIntent;

interface NewCampaignDraft {
  eventId: string;
  kind: CampaignKind;
  code: string;
  title: string;
}

interface OrganizerPromoViewProps {
  organizationName: string;
  summary: OrganizerSummary | null;
  events: OrganizerEvent[];
  rows: CampaignRow[];
  days: number;
  draft: NewCampaignDraft | null;
  busy: boolean;
  notice: string | null;
  failed: string | null;
  onDays: (days: number) => void;
  onOpenDraft: (kind: CampaignKind) => void;
  onDraft: (draft: NewCampaignDraft) => void;
  onCreate: () => void;
  onCancelDraft: () => void;
  onReport: () => void;
  onOpenEvent: (eventId: string) => void;
}

export function OrganizerPromoView({ organizationName, summary, events, rows, days, draft, busy, notice, failed, onDays, onOpenDraft, onDraft, onCreate, onCancelDraft, onReport, onOpenEvent }: OrganizerPromoViewProps) {
  const month = new Date().toLocaleDateString("ru-RU", { month: "long" });
  return (
    <section className="app-org-screen" aria-label="Промо и отчёты">
      <div className="app-org-topbar">
        <span className="app-org-topbar-text">
          <span className="app-org-topbar-title">Промо и отчёты</span>
          <span className="app-org-topbar-sub">
            {organizationName} · {month}
          </span>
        </span>
        <label className="app-org-period">
          <span className="app-org-period-label">Период</span>
          <select className="app-org-period-select" aria-label="Период отчёта" value={days} onChange={(change) => onDays(Number(change.target.value))}>
            {PROMO_PERIODS.map((period) => (
              <option key={period.days} value={period.days}>
                {period.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="app-org-form">
        <div className="app-org-tiles">
          <div className="app-org-tile">
            <span className="app-org-tile-label">Записей</span>
            <span className="app-org-tile-big">{summary === null ? "—" : formatCount(summary.bookings)}</span>
            <span className="app-org-tile-accent">{formatDelta(summary?.bookingsDeltaPercent ?? null)}</span>
          </div>
          <div className="app-org-tile">
            <span className="app-org-tile-label">Пришли</span>
            <span className="app-org-tile-big">{summary?.attendedPercent == null ? "—" : `${summary.attendedPercent}%`}</span>
            <span className="app-org-tile-note">Отмены: {summary?.cancelledPercent == null ? "—" : `${summary.cancelledPercent}%`}</span>
          </div>
        </div>
        <div className="app-org-chart">
          <span className="app-org-chart-title">Записи по дням</span>
          <span className="app-org-chart-bars" aria-hidden="true">
            {barHeights(summary?.byWeekday ?? [0, 0, 0, 0, 0, 0, 0]).map((bar, index) => (
              <span key={index} className={bar.accent ? "app-org-bar app-org-bar--on" : "app-org-bar"} style={{ height: `${bar.height}%` }} />
            ))}
          </span>
          <span className="app-org-chart-days" aria-hidden="true">
            {WEEKDAY_LABELS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </span>
        </div>
        <div className="app-org-sources">
          <span className="app-org-chart-title">Откуда приходят</span>
          {(summary?.sources ?? []).map((row) => (
            <span key={row.source} className="app-org-source">
              <span className="app-org-source-label">{TRAFFIC_SOURCE_LABELS[row.source]}</span>
              <span className="app-org-source-track" aria-hidden="true">
                <span className={`app-org-source-fill app-org-source-fill--${row.source}`} style={{ width: `${row.percent}%` }} />
              </span>
              <span className="app-org-source-value">{row.percent}%</span>
            </span>
          ))}
          {summary !== null && summary.sources.length === 0 && <span className="app-org-tile-note">Пока не из чего считать источники.</span>}
        </div>
        <p className="app-org-group-title">Активные кампании</p>
        {summary === null && <AppSkeletonList rows={2} />}
        {summary !== null && rows.length === 0 && <p className="app-org-empty">Кампаний пока нет — соберите первую ниже.</p>}
        {rows.map((row) => (
          <button key={row.id} type="button" className="app-org-campaign" onClick={() => onOpenEvent(row.eventId)}>
            <span className={row.accent ? "app-org-campaign-icon app-org-campaign-icon--on" : "app-org-campaign-icon"} aria-hidden="true">
              <ActionIcon name={row.icon} size={18} strokeWidth={2.2} />
            </span>
            <span className="app-org-campaign-body">
              <span className="app-org-campaign-title">{row.title}</span>
              <span className="app-org-campaign-note">{row.note}</span>
              {row.progress !== null && (
                <span className="app-org-progress" aria-hidden="true">
                  <span className="app-org-progress-fill" style={{ width: `${row.progress}%` }} />
                </span>
              )}
            </span>
            <span className="app-org-campaign-open">Открыть</span>
          </button>
        ))}
        {notice !== null && <p className="app-org-notice">{notice}</p>}
        {failed !== null && <AppState error>{failed}</AppState>}
        {draft === null ? (
          <div className="app-org-actions">
            <AppButton stretched disabled={events.length === 0} onClick={() => onOpenDraft("boost")}>
              Новая кампания
            </AppButton>
            <AppButton tone="secondary" stretched disabled={busy || events.length === 0} onClick={onReport}>
              Отчёт за месяц
            </AppButton>
          </div>
        ) : (
          <form
            className="app-org-campaign-form"
            onSubmit={(submit) => {
              submit.preventDefault();
              onCreate();
            }}
          >
            <label className="app-org-field">
              <span className="app-org-field-label">Событие</span>
              <select className="app-org-field-input" value={draft.eventId} onChange={(change) => onDraft({ ...draft, eventId: change.target.value })}>
                {events.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="app-org-field">
              <span className="app-org-field-label">Что делаем</span>
              <select className="app-org-field-input" value={draft.kind} onChange={(change) => onDraft({ ...draft, kind: change.target.value as CampaignKind })}>
                <option value="boost">Поднять в ленте на 24 часа</option>
                <option value="target_collection">Рассылка тем, кто был раньше</option>
                <option value="promocode">Промокод со скидкой</option>
              </select>
            </label>
            {draft.kind === "promocode" && (
              <label className="app-org-field">
                <span className="app-org-field-label">Код</span>
                <input className="app-org-field-input" value={draft.code} placeholder="ОСЕНЬ20" onChange={(change) => onDraft({ ...draft, code: change.target.value })} />
              </label>
            )}
            <div className="app-org-actions">
              <AppButton stretched type="submit" disabled={busy}>
                {busy ? "Создаём…" : "Создать"}
              </AppButton>
              <AppButton tone="ghost" stretched type="button" onClick={onCancelDraft}>
                Отмена
              </AppButton>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

/** Excel читает кириллицу в CSV только с BOM в начале файла. */
const CSV_BOM = "\uFEFF";

const DAY_MS = 86_400_000;

export function OrganizerPromo({ organizationName, intent, onOpenEvent }: { organizationName: string; intent: OrganizerPromoIntent | null; onOpenEvent: (eventId: string) => void }) {
  const [summary, setSummary] = useState<OrganizerSummary | null>(null);
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [days, setDays] = useState(30);
  const [draft, setDraft] = useState<NewCampaignDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let alive = true;
    apiClient.getOrganizerSummary(periodQueryFor(days)).then(
      (payload) => {
        if (alive) setSummary(payload);
      },
      () => {
        if (alive) setFailed("Не удалось загрузить отчёт.");
      },
    );
    return () => {
      alive = false;
    };
  }, [days, reloads]);

  useEffect(() => {
    let alive = true;
    apiClient.listOrganizerEvents().then(
      async (items) => {
        if (!alive) return;
        setEvents(items);
        const fetched = await Promise.all(items.map((item) => Promise.all([apiClient.listPromotions(item.id).catch(() => []), apiClient.listCampaigns(item.id).catch(() => []), apiClient.listOrganizerPromos(item.id).catch(() => [])])));
        if (!alive) return;
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
        if (alive) setFailed("Не удалось загрузить кампании.");
      },
    );
    return () => {
      alive = false;
    };
  }, [reloads]);

  const openDraft = useCallback(
    (kind: CampaignKind) => {
      setNotice(null);
      setFailed(null);
      setDraft({ eventId: events[0]?.id ?? "", kind, code: "", title: "Приведи друга" });
    },
    [events],
  );

  // Тайл «Отчёт» с экрана 45 сразу скачивает файл, остальные три открывают форму на нужном типе.
  useEffect(() => {
    if (intent === null || intent === "report" || events.length === 0) return;
    openDraft(intent);
  }, [intent, events.length, openDraft]);

  const create = () => {
    if (draft === null || draft.eventId === "") return;
    setBusy(true);
    setFailed(null);
    const now = Date.now();
    const request = draft.kind === "promocode" ? apiClient.createOrganizerPromo(draft.eventId, { code: draft.code.trim() }) : draft.kind === "boost" ? apiClient.createPromotion(draft.eventId, { type: "boost", startsAt: new Date(now).toISOString(), endsAt: new Date(now + DAY_MS).toISOString(), tariffCode: "boost-24h", priceRub: 0 }) : apiClient.createPromotion(draft.eventId, { type: "target_collection", startsAt: new Date(now).toISOString(), endsAt: new Date(now + 7 * DAY_MS).toISOString(), tariffCode: "target-7d", priceRub: 0, audience: { minVisits: 1, windowDays: 90 } });
    request.then(
      () => {
        setBusy(false);
        setDraft(null);
        setNotice("Кампания запущена");
        setReloads((value) => value + 1);
      },
      () => {
        setBusy(false);
        setFailed("Не удалось создать кампанию. Проверьте код — он может быть занят.");
      },
    );
  };

  const report = useCallback(() => {
    setBusy(true);
    setFailed(null);
    Promise.all(
      events.map((item) =>
        apiClient
          .getEventSales(item.id, periodQueryFor(days))
          .then((sales) => ({ title: item.title, report: sales }))
          .catch(() => null),
      ),
    )
      .then((reports) => {
        const csv = salesCsv(reports.filter((row): row is { title: string; report: EventSalesReport } => row !== null));
        const url = URL.createObjectURL(new Blob([CSV_BOM, csv], { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = `otchet-${days}-dney.csv`;
        link.click();
        URL.revokeObjectURL(url);
        setBusy(false);
        setNotice("Отчёт выгружен файлом");
      })
      .catch(() => {
        setBusy(false);
        setFailed("Не удалось собрать отчёт.");
      });
  }, [days, events]);

  useEffect(() => {
    if (intent === "report" && events.length > 0) report();
  }, [intent, events.length, report]);

  return <OrganizerPromoView organizationName={organizationName} summary={summary} events={events} rows={rows} days={days} draft={draft} busy={busy} notice={notice} failed={failed} onDays={setDays} onOpenDraft={openDraft} onDraft={setDraft} onCreate={create} onCancelDraft={() => setDraft(null)} onReport={report} onOpenEvent={onOpenEvent} />;
}
