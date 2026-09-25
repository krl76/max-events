// START_MODULE_CONTRACT
// PURPOSE: «Панель организатора» (макет, экран 45): the period hero, the weekly fill and traffic tiles, the organizer's own events with their fill, and the four promo tools.
// SCOPE: Pure helpers plus OrganizerDashboardView (presentational) and OrganizerDashboard (container). Per-event fill comes from the event day, the totals and the traffic split from the organizer summary; the four tools hand their intent to экран 48, which owns the forms.
// DEPENDS: react, ../api/client.js (apiClient, OrganizerAttendance, OrganizerEvent, OrganizerSummary, OrganizerTrafficSource), ../catalog/format.js (pluralRu), ../ui/primitives.js, ../ui/icons.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OrganizerPromoIntent - which of the four tools экран 48 should open on: boost | target_collection | promocode | report
// - ORGANIZER_PROMO_TOOLS - the four tiles in design order, with their glyph, title and second line
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
import { apiClient, type OrganizerEvent, type OrganizerSummary, type OrganizerTrafficSource } from "../api/client";
import { pluralRu } from "../catalog/format";
import { ActionIcon, type ActionIconName } from "../ui/icons";
import { AppMedia, AppSkeletonList, AppState } from "../ui/primitives";

export type OrganizerPromoIntent = "boost" | "target_collection" | "promocode" | "report";

export const ORGANIZER_PROMO_TOOLS: Array<{ intent: OrganizerPromoIntent; icon: ActionIconName; title: string; note: string }> = [
  { intent: "target_collection", icon: "megaphone", title: "Рассылка в чаты", note: "Тем, кто был раньше" },
  { intent: "boost", icon: "trend", title: "Поднять в ленте", note: "На 24 часа в районе" },
  { intent: "promocode", icon: "tag", title: "Промокод", note: "Скидка для компаний" },
  { intent: "report", icon: "upload", title: "Отчёт", note: "Экспорт за месяц" },
];

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

interface OrganizerDashboardViewProps {
  organizationName: string;
  summary: OrganizerSummary | null;
  events: OrganizerEvent[];
  fills: Record<string, OrganizerEventFill>;
  rating: number | null;
  failed: boolean;
  onOpenEvent: (event: OrganizerEvent) => void;
  onAllEvents: () => void;
  onTool: (intent: OrganizerPromoIntent) => void;
}

export function OrganizerDashboardView({ organizationName, summary, events, fills, rating, failed, onOpenEvent, onAllEvents, onTool }: OrganizerDashboardViewProps) {
  const month = new Date().toLocaleDateString("ru-RU", { month: "long" });
  const traffic = trafficLead(summary?.sources ?? []);
  const live = events.filter((item) => !item.draft);
  return (
    <section className="app-org-screen" aria-label="Панель организатора">
      <div className="app-org-hero">
        <span className="app-org-hero-blob" aria-hidden="true" />
        <div className="app-org-hero-top">
          <span className="app-org-mode">
            <span className="app-org-mode-switch" aria-hidden="true">
              <span className="app-org-mode-knob" />
            </span>
            Режим организатора
          </span>
          <span className="app-org-hero-avatar" aria-hidden="true">
            {organizationName.trim().slice(0, 1).toUpperCase()}
          </span>
        </div>
        <p className="app-org-hero-caption">
          {organizationName} · {month}
        </p>
        <p className="app-org-hero-value">{summary === null ? "—" : `${formatCount(summary.bookings)} ${pluralRu(summary.bookings, "запись", "записи", "записей")}`}</p>
        <div className="app-org-hero-stats">
          <span className="app-org-hero-stat">
            <b>{live.length}</b> {pluralRu(live.length, "активное", "активных", "активных")}
          </span>
          <span className="app-org-hero-stat">
            <b>{summary?.attendedPercent === null || summary === null ? "—" : `${summary.attendedPercent}%`}</b> пришли
          </span>
          <span className="app-org-hero-stat">
            <b>{rating === null ? "—" : rating.toFixed(1)}</b> оценка
          </span>
        </div>
      </div>
      {failed && <AppState error>Не удалось загрузить панель.</AppState>}
      <div className="app-org-tiles">
        <div className="app-org-tile">
          <span className="app-org-tile-label">Заполнение за неделю</span>
          <span className="app-org-bars" aria-hidden="true">
            {barHeights(summary?.byWeekday ?? [0, 0, 0, 0, 0, 0, 0]).map((bar, index) => (
              <span key={index} className={bar.accent ? "app-org-bar app-org-bar--on" : "app-org-bar"} style={{ height: `${bar.height}%` }} />
            ))}
          </span>
        </div>
        <div className="app-org-tile">
          <span className="app-org-tile-label">Откуда приходят</span>
          <span className="app-org-tile-value">{traffic.lead}</span>
          <span className="app-org-tile-note">{traffic.rest}</span>
        </div>
      </div>
      <div className="app-org-head">
        <h2 className="app-org-head-title">Мои события</h2>
        <button type="button" className="app-org-head-link" onClick={onAllEvents}>
          Все {events.length}
        </button>
      </div>
      {events.length === 0 && <AppSkeletonList rows={2} />}
      <div className="app-org-events">
        {events.slice(0, 4).map((item) => {
          const fill = fills[item.id];
          return (
            <button key={item.id} type="button" className="app-org-event" onClick={() => onOpenEvent(item)}>
              <AppMedia category={item.category} className="app-org-event-media" />
              <span className="app-org-event-body">
                <span className="app-org-event-title">{item.title}</span>
                <span className="app-org-event-meta">
                  {new Date(item.startsAt).toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" })} · {eventFillNote(fill, item.capacity)}
                </span>
                <span className="app-org-progress" aria-hidden="true">
                  <span className="app-org-progress-fill" style={{ width: `${item.capacity === null || fill === undefined ? 0 : Math.min(Math.round((fill.booked / item.capacity) * 100), 100)}%` }} />
                </span>
              </span>
              {item.draft && <span className="app-micro-badge">Черновик</span>}
              {!item.draft && needsPromotion(fill, item.capacity) && <span className="app-org-event-badge">ПРОДВИНУТЬ</span>}
            </button>
          );
        })}
      </div>
      <div className="app-org-head">
        <h2 className="app-org-head-title">Промо-инструменты</h2>
      </div>
      <div className="app-org-tools">
        {ORGANIZER_PROMO_TOOLS.map((tool) => (
          <button key={tool.intent} type="button" className="app-org-tool" onClick={() => onTool(tool.intent)}>
            <ActionIcon name={tool.icon} size={24} strokeWidth={2} />
            <span className="app-org-tool-title">{tool.title}</span>
            <span className="app-org-tool-note">{tool.note}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function OrganizerDashboard({ organizationId, organizationName, onOpenEvent, onAllEvents, onTool }: { organizationId: string; organizationName: string; onOpenEvent: (event: OrganizerEvent) => void; onAllEvents: () => void; onTool: (intent: OrganizerPromoIntent) => void }) {
  const [summary, setSummary] = useState<OrganizerSummary | null>(null);
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [fills, setFills] = useState<Record<string, OrganizerEventFill>>({});
  const [rating, setRating] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    apiClient.getOrganizerSummary().then(
      (payload) => {
        if (alive) setSummary(payload);
      },
      () => {
        if (alive) setFailed(true);
      },
    );
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
        // Заполнение берётся из дня события: там уже есть и записи, и лист ожидания, и это один запрос на карточку.
        Promise.all(
          sorted.slice(0, 4).map((item) =>
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

  return <OrganizerDashboardView organizationName={organizationName} summary={summary} events={events} fills={fills} rating={rating} failed={failed} onOpenEvent={onOpenEvent} onAllEvents={onAllEvents} onTool={onTool} />;
}
