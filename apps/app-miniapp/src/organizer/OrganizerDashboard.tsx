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

import { useEffect, useState } from "react";
import type { EventSalesReport } from "@max-events/api-contracts";
import { apiClient, type OrganizerEvent, type OrganizerSummary, type OrganizerTrafficSource, type StatsPeriodQuery } from "../api/client";
import { pluralRu } from "../catalog/format";
import { EventPoster } from "../search/EventPoster";
import { ActionIcon } from "../ui/icons";
import { AppButton, AppSkeletonList, AppState } from "../ui/primitives";

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

export function nearestEventReason(item: OrganizerEvent, fill: OrganizerEventFill | undefined, now = new Date()): string {
  if (item.draft) return "Черновик";
  const days = Math.ceil((new Date(item.startsAt).getTime() - now.getTime()) / 86_400_000);
  const when = days <= 0 ? "Сегодня" : `До начала ${days} ${pluralRu(days, "день", "дня", "дней")}`;
  const booked = fill?.booked ?? item.bookedCount ?? 0;
  const seats = item.capacity === null ? `${booked}` : `${booked} из ${item.capacity}`;
  return `${when} · зарегистрировано ${seats}`;
}

function EventFillRow({ item, fill, onOpen }: { item: OrganizerEvent; fill: OrganizerEventFill | undefined; onOpen: () => void }) {
  const booked = fill?.booked ?? item.bookedCount;
  return <EventPoster card={{ event: { ...item, bookedCount: booked }, distanceKm: null, rating: null, placeTitle: null }} reason={nearestEventReason(item, fill)} onOpen={() => onOpen()} />;
}

interface OrganizerDashboardViewProps {
  organizationName: string;
  summary: OrganizerSummary | null;
  events: OrganizerEvent[];
  fills: Record<string, OrganizerEventFill>;
  failed: boolean;
  weekBookings: number | null;
  weekAttended: number | null;
  onOpenEvent: (event: OrganizerEvent) => void;
  onCreateEvent: () => void;
  onOpenOrganization: () => void;
  onStats: () => void;
  onPlaces: () => void;
  onCheckIn: (event: OrganizerEvent) => void;
  onShowDrafts: () => void;
}

function isSameDay(iso: string, now: Date): boolean {
  const date = new Date(iso);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

export function OrganizerDashboardView({ organizationName, summary, events, fills, failed, weekBookings, weekAttended, onOpenEvent, onCreateEvent, onOpenOrganization, onStats, onPlaces, onCheckIn, onShowDrafts }: OrganizerDashboardViewProps) {
  const loaded = summary !== null || failed;
  const drafts = events.filter((item) => item.draft);
  const today = events.filter((item) => !item.draft && isSameDay(item.startsAt, new Date()));
  const upcoming = events.filter((item) => !item.draft && new Date(item.startsAt).getTime() >= Date.now()).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const next = upcoming[0];
  return (
    <section className="app-gathering" aria-label="Обзор организатора">
      <header className="app-org-overview-head">
        <h1 className="app-section-title">{organizationName}</h1>
        <p className="app-gathering-hint">Кабинет организатора</p>
      </header>
      {failed && (
        <AppState error action={{ label: "Повторить", onClick: () => window.location.reload() }}>
          Не удалось загрузить обзор.
        </AppState>
      )}
      {loaded && events.length === 0 && (
        <>
          <p className="app-gathering-hint">Создайте первое событие — после публикации здесь появятся задачи и результаты.</p>
          <AppButton stretched onClick={onCreateEvent}>
            Создать событие
          </AppButton>
        </>
      )}
      {drafts.length > 0 && (
        <>
          <h2 className="app-section-title">Требует внимания</h2>
          <button type="button" className="app-set-row" onClick={() => (drafts.length === 1 ? onOpenEvent(drafts[0]) : onShowDrafts())}>
            <span className="app-set-row-text">
              <span className="app-set-row-title">Черновик не опубликован</span>
              <span className="app-set-row-hint">{drafts.length === 1 ? drafts[0].title : `${drafts.length} ${pluralRu(drafts.length, "черновик ждёт", "черновика ждут", "черновиков ждут")} публикации`}</span>
            </span>
            <ActionIcon name="chevron" size={16} strokeWidth={2.6} />
          </button>
        </>
      )}
      {today.length > 0 && (
        <>
          <h2 className="app-section-title">Сегодня</h2>
          {today.slice(0, 2).map((item) => (
            <article key={item.id} className="app-set-group">
              <p className="app-set-row-title">{item.title}</p>
              <p className="app-set-row-hint">Начало {new Date(item.startsAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</p>
              <p className="app-set-row-hint">{eventFillNote(fills[item.id], item.capacity)}</p>
              <AppButton stretched onClick={() => onCheckIn(item)}>
                Контроль входа
              </AppButton>
            </article>
          ))}
        </>
      )}
      {events.length > 0 && <h2 className="app-section-title">За последние 7 дней</h2>}
      {events.length > 0 && (
        <div className="app-org-tiles">
          <button type="button" className="app-org-tile" onClick={onStats}>
            <span className="app-org-tile-label">Новые регистрации</span>
            <span className="app-org-tile-big">{weekBookings === null ? "Нет данных" : formatCount(weekBookings)}</span>
          </button>
          <button type="button" className="app-org-tile" onClick={onStats}>
            <span className="app-org-tile-label">Доля пришедших</span>
            <span className="app-org-tile-big">{weekAttended === null ? "Нет данных" : `${weekAttended}%`}</span>
          </button>
        </div>
      )}
      {events.length > 0 && <p className="app-gathering-hint">Оплаченные билеты здесь не считаются: оплата проходит на сайте организатора, и сумма заказа в кабинет не приходит.</p>}
      {events.length > 0 && (
        <AppButton stretched onClick={onCreateEvent}>
          + Создать событие
        </AppButton>
      )}
      {next !== undefined && (
        <>
          <h2 className="app-section-title">Ближайшее событие</h2>
          <EventFillRow item={next} fill={fills[next.id]} onOpen={() => onOpenEvent(next)} />
        </>
      )}
      {events.length > 0 && (
      <div className="app-set-group">
        <button type="button" className="app-set-row" onClick={onPlaces}>
          <span className="app-set-row-text">
            <span className="app-set-row-title">Мои места</span>
            <span className="app-set-row-hint">Площадки, к которым привязаны события</span>
          </span>
          <ActionIcon name="chevron" size={16} strokeWidth={2.6} />
        </button>
        <button type="button" className="app-set-row" onClick={onStats}>
          <span className="app-set-row-text">
            <span className="app-set-row-title">Статистика</span>
            <span className="app-set-row-hint">Регистрации и источники за период</span>
          </span>
          <ActionIcon name="chevron" size={16} strokeWidth={2.6} />
        </button>
        <button type="button" className="app-set-row" onClick={onOpenOrganization}>
          <span className="app-set-row-text">
            <span className="app-set-row-title">Публичная страница</span>
            <span className="app-set-row-hint">Как организацию видят в профиле кабинета</span>
          </span>
          <ActionIcon name="chevron" size={16} strokeWidth={2.6} />
        </button>
      </div>
      )}
      {!loaded && events.length === 0 && <AppSkeletonList rows={2} />}
    </section>
  );
}

export function OrganizerDashboard({ organizationId, organizationName, onOpenEvent, onCreateEvent, onOpenOrganization, onStats, onPlaces, onCheckIn, onShowDrafts }: { organizationId: string; organizationName: string; onOpenEvent: (event: OrganizerEvent) => void; onCreateEvent: () => void; onOpenOrganization: () => void; onStats: () => void; onPlaces: () => void; onCheckIn: (event: OrganizerEvent) => void; onShowDrafts: () => void }) {
  const [summary, setSummary] = useState<OrganizerSummary | null>(null);
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [fills, setFills] = useState<Record<string, OrganizerEventFill>>({});
  const [failed, setFailed] = useState(false);
  const [weekBookings, setWeekBookings] = useState<number | null>(null);
  const [weekAttended, setWeekAttended] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    apiClient.getOrganizerSummary(periodQueryFor(7)).then(
      (payload) => {
        if (!alive) return;
        setSummary(payload);
        setWeekBookings(payload.bookings);
        setWeekAttended(payload.attendedPercent);
      },
      () => {
        if (alive) setFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
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

  return <OrganizerDashboardView organizationName={organizationName} summary={summary} events={events} fills={fills} failed={failed} weekBookings={weekBookings} weekAttended={weekAttended} onOpenEvent={onOpenEvent} onCreateEvent={onCreateEvent} onOpenOrganization={onOpenOrganization} onStats={onStats} onPlaces={onPlaces} onCheckIn={onCheckIn} onShowDrafts={onShowDrafts} />;
}
