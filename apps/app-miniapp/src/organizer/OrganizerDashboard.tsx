// START_MODULE_CONTRACT
// PURPOSE: Organizer overview: period, bookings, attendance, weekday bars, traffic sources, rating and the events that are filling slowly. Promotion actions live on the promotion section.
// SCOPE: Pure helpers plus OrganizerDashboardView (presentational) and OrganizerDashboard (container). Per-event fill comes from the event day, the totals and the traffic split from the organizer summary.
// DEPENDS: react, ../api/client.js (apiClient, OrganizerAttendance, OrganizerEvent, OrganizerSummary, OrganizerTrafficSource), ../catalog/format.js (pluralRu), ../ui/primitives.js, ../ui/icons.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OrganizerPromoIntent - which promotion action to open: boost | target_collection | promocode | referral | early_access
// - PROMO_PERIODS - 7 / 30 / 90 day windows, 30 is the default
// - periodQueryFor - a window of N days back from now
// - formatDelta - «+18% к прошлому периоду»
// - salesCsv - month report built from sales rows, because the backend has no export of its own
// - TRAFFIC_SOURCE_LABELS - ru label per traffic source
// - formatCount - «1 284»: thin-space groups, the way the hero prints its numbers
// - barHeights - the weekday histogram as 0..100 heights, with the two tallest days marked as the accent bars
// - trafficLead - «62% из чатов» and the «24% лента · 14% поиск» line under it
// - OrganizerEventFill - how full one event is: its bookings and who is waiting behind them
// - eventFillNote - «16 из 20 · лист ожидания 7», or «Без предела мест» where nothing caps the event
// - needsPromotion - an event under two fifths full with the date approaching: the «ПРОДВИНУТЬ» badge
// - OrganizerDashboardView - presentational: hero, tiles, own events, promo tools
// - OrganizerDashboard - container: the summary, the events and the per-event fill
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import type { EventSalesReport } from "@max-events/api-contracts";
import { apiClient, type OrganizerEvent, type OrganizerSummary, type OrganizerTrafficSource, type StatsPeriodQuery } from "../api/client";
import { pluralRu } from "../catalog/format";
import { EventPoster } from "../search/EventPoster";
import { AppButton, AppChip, AppSkeletonList, AppState } from "../ui/primitives";

export type OrganizerPromoIntent = "boost" | "target_collection" | "promocode" | "referral" | "early_access";

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

/** Excel reads Cyrillic CSV only with a BOM. The backend has sales rows and no file export. */
const CSV_BOM = "\uFEFF";

export function salesCsv(reports: Array<{ title: string; report: EventSalesReport }>): string {
  const lines = ["событие;платёж;бронь;сумма, ₽;комиссия, ₽;нетто, ₽;контур;дата"];
  let gross = 0;
  let commission = 0;
  let net = 0;
  for (const { title, report } of reports) {
    for (const row of report.rows) {
      lines.push([title, row.paymentId, row.bookingId, row.grossRub, row.commissionRub, row.netRub, report.provider, row.commissionFixedAt].join(";"));
    }
    gross += report.grossRub;
    commission += report.commissionRub;
    net += report.netRub;
  }
  lines.push(["ИТОГО", "", "", gross, commission, net, "", ""].join(";"));
  return lines.join("\n");
}

export const TRAFFIC_SOURCE_LABELS: Record<OrganizerTrafficSource, string> = { chats: "Чаты MAX", feed: "Лента", search: "Поиск" };

/** Thin spaces, not commas: the hero prints «1 284 записи» and the tiles «1 284». */
export function formatCount(value: number): string {
  return value.toLocaleString("ru-RU").replace(/\s/g, "\u00a0");
}

/**
 * Heights are relative to the tallest day, so a quiet week still draws a readable chart. The two busiest
 * days carry the accent — the design marks the peak, not an arbitrary threshold.
 */
export function barHeights(byWeekday: number[]): Array<{ height: number; accent: boolean }> {
  const max = Math.max(...byWeekday, 0);
  const ranked = [...byWeekday].sort((a, b) => b - a);
  const accentFrom = ranked[1] ?? ranked[0] ?? 0;
  return byWeekday.map((value) => ({ height: max === 0 ? 0 : Math.max(Math.round((value / max) * 100), 6), accent: max > 0 && value >= accentFrom && value > 0 }));
}

export function trafficLead(sources: Array<{ source: OrganizerTrafficSource; percent: number }>): { lead: string; rest: string } {
  if (sources.length === 0) return { lead: "Пока не из чего считать", rest: "" };
  const sorted = [...sources].sort((a, b) => b.percent - a.percent);
  return {
    lead: `${sorted[0].percent}% ${sorted[0].source === "chats" ? "из чатов" : sorted[0].source === "feed" ? "из ленты" : "из поиска"}`,
    rest: sorted
      .slice(1)
      .map((row) => `${row.percent}% ${TRAFFIC_SOURCE_LABELS[row.source].toLowerCase()}`)
      .join(" · "),
  };
}

export interface OrganizerEventFill {
  booked: number;
  waitlist: number;
}

export function eventFillNote(fill: OrganizerEventFill | undefined, capacity: number | null): string {
  if (fill === undefined) return capacity === null ? "Без предела мест" : `до ${capacity} мест`;
  const seats = capacity === null ? `${fill.booked} ${pluralRu(fill.booked, "запись", "записи", "записей")}` : `${fill.booked} из ${capacity}`;
  return fill.waitlist === 0 ? seats : `${seats} · лист ожидания ${fill.waitlist}`;
}

/** Under two fifths full and nobody waiting: the one case where the design offers to promote the event. */
export function needsPromotion(fill: OrganizerEventFill | undefined, capacity: number | null): boolean {
  if (fill === undefined || capacity === null || capacity <= 0) return false;
  return fill.waitlist === 0 && fill.booked / capacity < 0.4;
}

function EventFillRow({ item, fill, onOpen }: { item: OrganizerEvent; fill: OrganizerEventFill | undefined; onOpen: () => void }) {
  const booked = fill?.booked ?? item.bookedCount;
  return (
    <EventPoster
      card={{ event: { ...item, bookedCount: booked }, distanceKm: null, rating: null, placeTitle: null }}
      reason={item.draft ? "Черновик" : needsPromotion(fill, item.capacity) ? "Мало записей" : null}
      onOpen={() => onOpen()}
    />
  );
}

interface OrganizerDashboardViewProps {
  organizationName: string;
  summary: OrganizerSummary | null;
  events: OrganizerEvent[];
  fills: Record<string, OrganizerEventFill>;
  rating: number | null;
  failed: boolean;
  days: number;
  reportBusy: boolean;
  reportNotice: string | null;
  onDays: (days: number) => void;
  onOpenEvent: (event: OrganizerEvent) => void;
  onAllEvents: () => void;
  onCreateEvent: () => void;
  onOpenOrganization: () => void;
  onReport: () => void;
}

export function OrganizerDashboardView({ organizationName, summary, events, fills, rating, failed, days, reportBusy, reportNotice, onDays, onOpenEvent, onAllEvents, onCreateEvent, onOpenOrganization, onReport }: OrganizerDashboardViewProps) {
  const month = new Date().toLocaleDateString("ru-RU", { month: "long" });
  const sources = summary?.sources ?? [];
  const traffic = trafficLead(sources.some((row) => row.percent > 0) ? sources : []);
  const live = events.filter((item) => !item.draft);
  const quiet = events.filter((item) => needsPromotion(fills[item.id], item.capacity));
  const loaded = summary !== null || failed;
  return (
    <section className="app-gathering" aria-label="Обзор организатора">
      <div className="app-me-metrics">
        <p className="app-gathering-hint">
          {organizationName} · {month} · {formatDelta(summary?.bookingsDeltaPercent ?? null)}
        </p>
        <div className="app-me-metrics-row">
          <span className="app-me-metric">
            <span className="app-me-metric-value">{summary === null ? "—" : formatCount(summary.bookings)}</span>
            <span className="app-me-metric-label">{pluralRu(summary?.bookings ?? 0, "запись", "записи", "записей")}</span>
          </span>
          <span className="app-me-metric">
            <span className="app-me-metric-value">{live.length}</span>
            <span className="app-me-metric-label">{pluralRu(live.length, "активное", "активных", "активных")}</span>
          </span>
          <span className="app-me-metric">
            <span className="app-me-metric-value">{summary?.attendedPercent == null ? "—" : `${summary.attendedPercent}%`}</span>
            <span className="app-me-metric-label">пришли</span>
          </span>
          <span className="app-me-metric">
            <span className="app-me-metric-value">{summary?.cancelledPercent == null ? "—" : `${summary.cancelledPercent}%`}</span>
            <span className="app-me-metric-label">отмены</span>
          </span>
          <span className="app-me-metric">
            <span className="app-me-metric-value">{rating === null ? "—" : rating.toFixed(1)}</span>
            <span className="app-me-metric-label">оценка</span>
          </span>
        </div>
        <AppButton stretched onClick={onOpenOrganization}>
          Организация
        </AppButton>
      </div>
      {failed && <AppState error>Не удалось загрузить обзор.</AppState>}
      <div className="app-filters-chips" role="group" aria-label="Период отчёта">
        {PROMO_PERIODS.map((period) => (
          <AppChip key={period.days} pressed={days === period.days} onClick={() => onDays(period.days)}>
            {period.label}
          </AppChip>
        ))}
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
      {summary !== null && summary.bookings === 0 && <p className="app-org-tile-note">Записей за этот период пока нет. График появится после первых регистраций.</p>}
      <div className="app-org-sources">
        <span className="app-org-chart-title">Откуда приходят</span>
        <span className="app-org-tile-value">{traffic.lead}</span>
        {traffic.rest !== "" && <span className="app-org-tile-note">{traffic.rest}</span>}
        {sources.map((row) => (
          <span key={row.source} className="app-org-source">
            <span className="app-org-source-label">{TRAFFIC_SOURCE_LABELS[row.source]}</span>
            <span className="app-org-source-track" aria-hidden="true">
              <span className={`app-org-source-fill app-org-source-fill--${row.source}`} style={{ width: `${row.percent}%` }} />
            </span>
            <span className="app-org-source-value">{row.percent}%</span>
          </span>
        ))}
      </div>
      {events.length === 0 && !loaded && <AppSkeletonList rows={2} />}
      {events.length === 0 && loaded && (
        <div>
          <p className="app-gathering-hint">Событий ещё нет. Создайте первое — здесь появятся записи, явка и источники.</p>
          <AppButton stretched onClick={onCreateEvent}>
            Создать событие
          </AppButton>
        </div>
      )}
      {quiet.length > 0 && (
        <>
          <h2 className="app-section-title">Мало записей</h2>
          <div>
            {quiet.slice(0, 3).map((item) => (
              <EventFillRow key={item.id} item={item} fill={fills[item.id]} onOpen={() => onOpenEvent(item)} />
            ))}
          </div>
        </>
      )}
      {events.length > 0 && (
        <>
          <div className="app-org-head">
            <h2 className="app-section-title">Ближайшие</h2>
            <button type="button" className="app-org-head-link" onClick={onAllEvents}>
              Все {events.length}
            </button>
          </div>
          <div>
            {events.slice(0, 4).map((item) => (
              <EventFillRow key={item.id} item={item} fill={fills[item.id]} onOpen={() => onOpenEvent(item)} />
            ))}
          </div>
        </>
      )}
      {reportNotice !== null && <p className="app-org-notice">{reportNotice}</p>}
      <div className="app-org-actions">
        <AppButton stretched disabled={reportBusy || events.length === 0} onClick={onReport}>
          {reportBusy ? "Собираем отчёт…" : "Отчёт за период"}
        </AppButton>
      </div>
    </section>
  );
}

export function OrganizerDashboard({ organizationId, organizationName, onOpenEvent, onAllEvents, onCreateEvent, onOpenOrganization }: { organizationId: string; organizationName: string; onOpenEvent: (event: OrganizerEvent) => void; onAllEvents: () => void; onCreateEvent: () => void; onOpenOrganization: () => void }) {
  const [summary, setSummary] = useState<OrganizerSummary | null>(null);
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [fills, setFills] = useState<Record<string, OrganizerEventFill>>({});
  const [rating, setRating] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [days, setDays] = useState(30);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportNotice, setReportNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    apiClient.getOrganizerSummary(periodQueryFor(days)).then(
      (payload) => {
        if (alive) setSummary(payload);
      },
      () => {
        if (alive) setFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [days]);

  useEffect(() => {
    let alive = true;
    apiClient.getOrganizerRating(organizationId).then(
      (payload) => {
        if (alive) setRating(payload.rating?.averageStars ?? null);
      },
      () => {},
    );
    apiClient.listOrganizerEvents().then(
      (items) => {
        if (!alive) return;
        const sorted = [...items].sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
        setEvents(sorted);
        Promise.all(
          sorted.slice(0, 8).map((item) =>
            apiClient
              .getOrganizerAttendance(item.id)
              .then((day) => [item.id, { booked: day.bookedCount, waitlist: day.waitlistCount }] as const)
              .catch(() => null),
          ),
        ).then((rows) => {
          if (alive) setFills(Object.fromEntries(rows.filter((row): row is readonly [string, OrganizerEventFill] => row !== null)));
        });
      },
      () => {
        if (alive) setFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [organizationId]);

  const onReport = useCallback(() => {
    setReportBusy(true);
    setReportNotice(null);
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
        setReportBusy(false);
        setReportNotice("Отчёт выгружен файлом");
      })
      .catch(() => {
        setReportBusy(false);
        setReportNotice("Не удалось собрать отчёт.");
      });
  }, [days, events]);

  return <OrganizerDashboardView organizationName={organizationName} summary={summary} events={events} fills={fills} rating={rating} failed={failed} days={days} reportBusy={reportBusy} reportNotice={reportNotice} onDays={setDays} onOpenEvent={onOpenEvent} onAllEvents={onAllEvents} onCreateEvent={onCreateEvent} onOpenOrganization={onOpenOrganization} onReport={onReport} />;
}
