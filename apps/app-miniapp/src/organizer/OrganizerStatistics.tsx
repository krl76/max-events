// START_MODULE_CONTRACT
// PURPOSE: Organizer «Статистика» tab — CRM home: period, registrations, guest funnel, occupancy, returning guests, weekday chart, traffic sources, lead time, today’s door, and cabinet actions. The header bell is the visitor one and opens the same inbox.
// SCOPE: Presentational screen over GET /organizer/summary with cabinet fallback. Occupancy is one aggregate visual; per-event fill lives on the event hub. Rubles stay on Finance. The bell count is the MAX user's unread summary.
// DEPENDS: react, ../api/client.js, ../ui/icons.js, ../ui/theme.css, ./cabinet-catalog.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT

import { useEffect, useState } from "react";
import { apiClient, type OrganizerEvent, type OrganizerLeadShare, type OrganizerSummary, type OrganizerTrafficShare } from "../api/client";
import { SettingsGroup } from "../profile/SettingsPage";
import { ActionIcon } from "../ui/icons";
import { pictured } from "../ui/photos";
import { AppChip, AppMedia } from "../ui/primitives";
import { CABINET_ATTENDED_PERCENT, CABINET_CANCELLED_PERCENT, CABINET_EVENTS, CABINET_LEAD, CABINET_LEAD_LABELS, CABINET_REPEAT_PERCENT, CABINET_TRAFFIC, CABINET_TRAFFIC_LABELS, cabinetAsOrganizerEvent, cabinetLeadTitle, cabinetOccupancy, cabinetSoldOut, cabinetStats, cabinetTrafficLead, cabinetViews, cabinetWeakUpcoming, cabinetWeekdayBookings, defaultStatsRange } from "./cabinet-catalog";

const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"] as const;
const WEEKDAY_PEAK = ["в понедельник", "во вторник", "в среду", "в четверг", "в пятницу", "в субботу", "в воскресенье"] as const;

function countLabel(value: number): string {
  return value.toLocaleString("ru-RU").replace(/\s/g, "\u00a0");
}

function occupancyBars(values: number[]): Array<{ height: number; accent: boolean }> {
  const max = Math.max(...values, 0);
  const ranked = [...values].sort((a, b) => b - a);
  const accentFrom = ranked[1] ?? ranked[0] ?? 0;
  return values.map((value) => ({
    height: max === 0 ? 0 : Math.max(6, Math.round((value / max) * 100)),
    accent: max > 0 && value >= accentFrom && value > 0,
  }));
}

function weekdayLead(values: number[]): string {
  const max = Math.max(...values, 0);
  if (max === 0) return "Регистрации по дням недели";
  return `Пик ${WEEKDAY_PEAK[values.indexOf(max)] ?? "за неделю"}`;
}

function periodQueryFor(days: number, now = new Date()): { from: string; to: string } {
  return { from: new Date(now.getTime() - days * 86_400_000).toISOString(), to: now.toISOString() };
}

function shareOf(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(6, Math.round((value / max) * 100));
}

function StatTrack({ label, value, width }: { label: string; value: string; width: number }) {
  return (
    <div className="app-org-source">
      <span className="app-org-source-label">{label}</span>
      <span className="app-org-source-track" aria-hidden="true">
        <span className="app-org-source-fill app-org-source-fill--chats" style={{ width: `${Math.min(100, Math.max(0, width))}%` }} />
      </span>
      <span className="app-org-source-value">{value}</span>
    </div>
  );
}

export type StatsWindow = 7 | 30 | 90;

export interface StatsEventRow {
  title: string;
  percent: number;
  amountRub: number;
  tone: "purple" | "coral" | "blue" | "green";
}

export interface StatsSnapshot {
  incomeRub: number;
  delta: number;
  events: number;
  eventsDelta: number;
  tickets: number;
  ticketsDelta: number;
  averageRub: number;
  averageDelta: number;
  conversion: number;
  conversionDelta: number;
  promos: number;
  promoUses: number;
  mailings: number;
  openRate: number;
  rows: StatsEventRow[];
}

export interface IncomePoint {
  label: string;
  value: number;
}

export const STATS_WINDOWS: StatsWindow[] = [7, 30, 90];

export const STATS_SNAPSHOTS: Record<StatsWindow, StatsSnapshot> = {
  30: {
    incomeRub: 482_750,
    delta: 24,
    events: 12,
    eventsDelta: 33,
    tickets: 2_842,
    ticketsDelta: 42,
    averageRub: 1_176,
    averageDelta: 18,
    conversion: 82,
    conversionDelta: 7,
    promos: 5,
    promoUses: 648,
    mailings: 3,
    openRate: 47,
    rows: [
      { title: "Вечер джаза на Патриарших", percent: 32, amountRub: 912_000, tone: "purple" },
      { title: "Ночной забег по набережной", percent: 24, amountRub: 684_000, tone: "coral" },
      { title: "Экскурсия по Замоскворечью", percent: 18, amountRub: 512_000, tone: "blue" },
      { title: "Фестиваль уличной еды", percent: 14, amountRub: 398_000, tone: "green" },
      { title: "Клуб «Ритм»", percent: 12, amountRub: 325_000, tone: "purple" },
    ],
  },
  7: {
    incomeRub: 86_400,
    delta: 11,
    events: 4,
    eventsDelta: 8,
    tickets: 410,
    ticketsDelta: 15,
    averageRub: 980,
    averageDelta: 6,
    conversion: 74,
    conversionDelta: 3,
    promos: 2,
    promoUses: 120,
    mailings: 1,
    openRate: 39,
    rows: [
      { title: "Вечер джаза на Патриарших", percent: 46, amountRub: 168_000, tone: "purple" },
      { title: "Ночной забег по набережной", percent: 31, amountRub: 112_000, tone: "coral" },
      { title: "Клуб «Ритм»", percent: 23, amountRub: 84_000, tone: "purple" },
    ],
  },
  90: {
    incomeRub: 1_260_480,
    delta: 18,
    events: 28,
    eventsDelta: 21,
    tickets: 7_420,
    ticketsDelta: 27,
    averageRub: 1_340,
    averageDelta: 9,
    conversion: 79,
    conversionDelta: 4,
    promos: 11,
    promoUses: 1_840,
    mailings: 8,
    openRate: 44,
    rows: [
      { title: "Вечер джаза на Патриарших", percent: 28, amountRub: 1_420_000, tone: "purple" },
      { title: "Ночной забег по набережной", percent: 22, amountRub: 1_110_000, tone: "coral" },
      { title: "Экскурсия по Замоскворечью", percent: 19, amountRub: 960_000, tone: "blue" },
      { title: "Фестиваль уличной еды", percent: 17, amountRub: 860_000, tone: "green" },
      { title: "Клуб «Ритм»", percent: 14, amountRub: 710_000, tone: "purple" },
    ],
  },
};

export const INCOME_CHART: Record<StatsWindow, IncomePoint[]> = {
  7: [
    { label: "23.09", value: 8_000 },
    { label: "24.09", value: 14_000 },
    { label: "25.09", value: 18_000 },
    { label: "26.09", value: 16_000 },
    { label: "27.09", value: 32_400 },
    { label: "28.09", value: 21_000 },
    { label: "29.09", value: 28_000 },
  ],
  30: [
    { label: "01.09", value: 18_000 },
    { label: "06.09", value: 22_000 },
    { label: "11.09", value: 16_000 },
    { label: "16.09", value: 27_000 },
    { label: "21.09", value: 24_000 },
    { label: "26.09", value: 31_000 },
    { label: "29.09", value: 36_000 },
  ],
  90: [
    { label: "07.07", value: 12_000 },
    { label: "21.07", value: 18_000 },
    { label: "04.08", value: 15_000 },
    { label: "18.08", value: 26_000 },
    { label: "01.09", value: 22_000 },
    { label: "15.09", value: 30_000 },
    { label: "29.09", value: 34_000 },
  ],
};

export function periodCaption(window: StatsWindow): string {
  return `Последние ${window} дней`;
}

export function chartPeak(points: IncomePoint[]): IncomePoint {
  return points.reduce((best, point) => (point.value > best.value ? point : best));
}

export function axisTop(points: IncomePoint[]): number {
  const peak = Math.max(...points.map((point) => point.value), 0);
  return Math.max(10_000, Math.ceil(peak / 10_000) * 10_000);
}

export function OrganizerStatistics({ onCheckIn, onShowDrafts, onPromote, onNotices, noticesOpen = false }: { onCreateEvent?: () => void; onOpenEvent?: (event: OrganizerEvent) => void; onCheckIn?: (event: OrganizerEvent) => void; onShowDrafts?: () => void; onPromote?: () => void; onNotices?: () => void; noticesOpen?: boolean }) {
  const initial = defaultStatsRange();
  const [days, setDays] = useState<StatsWindow>(30);
  const [to] = useState(initial.to);
  const from = new Date(new Date(`${to}T12:00:00+03:00`).getTime() - days * 86_400_000).toISOString().slice(0, 10);
  const [unread, setUnread] = useState(0);
  const [summary, setSummary] = useState<OrganizerSummary | null>(null);
  const rangeFrom = new Date(`${from}T00:00:00+03:00`);
  const rangeTo = new Date(`${to}T23:59:59+03:00`);
  const now = new Date(`${to}T12:00:00+03:00`);
  const snapshot = cabinetStats(CABINET_EVENTS, rangeFrom, rangeTo);
  const occupancy = cabinetOccupancy(CABINET_EVENTS, rangeFrom, rangeTo);
  const weak = cabinetWeakUpcoming(CABINET_EVENTS, now);
  const today = CABINET_EVENTS.find((item) => !item.draft && item.startsAt.slice(0, 10) === to);
  const drafts = CABINET_EVENTS.filter((item) => item.draft).length;
  const bookings = summary?.bookings ?? snapshot.tickets;
  const seatsBooked = summary?.seatsBooked ?? occupancy.booked;
  const seatsCapacity = summary?.seatsCapacity ?? occupancy.capacity;
  const occupancyPercent = summary?.occupancyPercent ?? occupancy.fill;
  const attendedPercent = summary?.attendedPercent ?? CABINET_ATTENDED_PERCENT;
  const cancelledPercent = summary?.cancelledPercent ?? CABINET_CANCELLED_PERCENT;
  const repeatPercent = summary?.repeatGuestPercent ?? CABINET_REPEAT_PERCENT;
  const views = summary?.views ?? cabinetViews(bookings);
  const conversion = summary?.conversionPercent ?? (views <= 0 ? null : Math.round((bookings / views) * 100));
  const bookingsDelta = summary?.bookingsDeltaPercent ?? snapshot.ticketsDelta;
  const waitlist = summary?.waitlist ?? 0;
  const uniqueGuests = summary?.uniqueGuests ?? Math.max(0, Math.round(bookings * 0.85));
  const newPercent = summary?.newGuestPercent ?? (repeatPercent === null ? null : Math.max(0, 100 - repeatPercent));
  const eventsCount = summary?.events ?? snapshot.events;
  const soldOut = summary?.soldOut ?? cabinetSoldOut(CABINET_EVENTS, rangeFrom, rangeTo);
  const weekdays = summary?.byWeekday ?? cabinetWeekdayBookings(CABINET_EVENTS, rangeFrom, rangeTo);
  const sources: OrganizerTrafficShare[] = summary?.sources ?? CABINET_TRAFFIC;
  const lead: OrganizerLeadShare[] = summary?.lead ?? CABINET_LEAD;
  const attended = attendedPercent === null ? 0 : Math.round((bookings * attendedPercent) / 100);
  const cancelled = cancelledPercent === null ? 0 : Math.round((bookings * cancelledPercent) / 100);
  const funnelMax = Math.max(views, bookings, 1);
  useEffect(() => {
    if (noticesOpen) return;
    let alive = true;
    apiClient.getNotificationsSummary("", { asVisitor: true }).then(
      (payload) => {
        if (alive) setUnread(payload.unreadCount);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [noticesOpen]);
  useEffect(() => {
    let alive = true;
    apiClient.getOrganizerSummary(periodQueryFor(days)).then(
      (payload) => {
        if (alive) setSummary(payload);
      },
      () => {
        if (alive) setSummary(null);
      },
    );
    return () => {
      alive = false;
    };
  }, [days]);

  return (
    <section className="app-gathering" aria-label="Статистика">
      <div className="app-org-head">
        <h1 className="app-section-title">Статистика</h1>
        <button type="button" className="app-header-bell" aria-label={unread === 0 ? "Уведомления" : `Уведомления: ${unread} новых`} onClick={() => onNotices?.()}>
          <ActionIcon name="bell" size={24} />
          {unread > 0 && <span className="app-header-bell-dot" aria-hidden="true" />}
        </button>
      </div>
      <div className="app-filters-chips" role="group" aria-label="Период">
        {STATS_WINDOWS.map((item) => (
          <AppChip key={item} pressed={days === item} onClick={() => setDays(item)}>
            {item} дней
          </AppChip>
        ))}
      </div>
      <div className="app-org-kpi">
        <span className="app-org-kpi-value">{countLabel(bookings)}</span>
        <span className="app-org-kpi-label">регистрации</span>
        {(conversion !== null || bookingsDelta !== null) && (
          <span className="app-org-kpi-note">
            {conversion !== null && <span>{conversion}% из просмотров</span>}
            {bookingsDelta !== null && <span className="app-org-kpi-delta">{bookingsDelta > 0 ? `+${bookingsDelta}%` : `${bookingsDelta}%`}</span>}
          </span>
        )}
      </div>
      <div className="app-org-sources" aria-label="Путь гостя">
        <span className="app-org-chart-title">Путь гостя</span>
        <StatTrack label="Просмотры" value={countLabel(views)} width={shareOf(views, funnelMax)} />
        <StatTrack label="Записи" value={countLabel(bookings)} width={shareOf(bookings, funnelMax)} />
        <StatTrack label="Дошли" value={countLabel(attended)} width={shareOf(attended, funnelMax)} />
        <StatTrack label="Отмены" value={countLabel(cancelled)} width={shareOf(cancelled, funnelMax)} />
      </div>
      {seatsCapacity > 0 && (
        <div className="app-org-sources" aria-label="Места">
          <span className="app-org-chart-title">Места</span>
          <StatTrack label="Занято" value={`${occupancyPercent ?? 0}%`} width={occupancyPercent ?? 0} />
          {soldOut > 0 && <StatTrack label="Без мест" value={countLabel(soldOut)} width={shareOf(soldOut, Math.max(eventsCount, 1))} />}
          <span className="app-org-source-note">
            {countLabel(seatsBooked)} из {countLabel(seatsCapacity)}
          </span>
        </div>
      )}
      {(repeatPercent !== null || newPercent !== null) && (
        <div className="app-org-sources" aria-label="Гости">
          <span className="app-org-chart-title">{uniqueGuests > 0 ? `${countLabel(uniqueGuests)} гостей` : "Гости"}</span>
          {repeatPercent !== null && <StatTrack label="Повторно" value={`${repeatPercent}%`} width={repeatPercent} />}
          {newPercent !== null && <StatTrack label="Новые" value={`${newPercent}%`} width={newPercent} />}
        </div>
      )}
      <div className="app-org-chart">
        <span className="app-org-chart-title">{weekdayLead(weekdays)}</span>
        <span className="app-org-chart-bars" aria-hidden="true">
          {occupancyBars(weekdays).map((bar, index) => (
            <span key={WEEKDAYS[index]} className={bar.accent ? "app-org-bar app-org-bar--on" : "app-org-bar"} style={{ height: `${bar.height}%` }} />
          ))}
        </span>
        <span className="app-org-chart-days" aria-hidden="true">
          {WEEKDAYS.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </span>
      </div>
      <div className="app-org-sources" aria-label="Источники регистраций">
        <span className="app-org-chart-title">{cabinetTrafficLead(sources)}</span>
        {sources.map((row) => (
          <div key={row.source} className="app-org-source">
            <span className="app-org-source-label">{CABINET_TRAFFIC_LABELS[row.source]}</span>
            <span className="app-org-source-track" aria-hidden="true">
              <span className={`app-org-source-fill app-org-source-fill--${row.source}`} style={{ width: `${row.percent}%` }} />
            </span>
            <span className="app-org-source-value">{row.percent}%</span>
          </div>
        ))}
      </div>
      <div className="app-org-sources" aria-label="Когда записываются">
        <span className="app-org-chart-title">{cabinetLeadTitle(lead)}</span>
        {lead.map((row) => (
          <StatTrack key={row.bucket} label={CABINET_LEAD_LABELS[row.bucket]} value={`${row.percent}%`} width={row.percent} />
        ))}
      </div>
      {today !== undefined && onCheckIn !== undefined && (
        <button type="button" className="app-org-now" onClick={() => onCheckIn(cabinetAsOrganizerEvent(today))}>
          <AppMedia category={today.category} src={pictured(today.id, null)} className="app-org-now-media" />
          <span className="app-org-now-veil" aria-hidden="true" />
          <span className="app-org-now-copy">
            <span className="app-org-now-chip">Сегодня</span>
            <span className="app-org-now-title">{today.title}</span>
            <span>Контроль входа</span>
          </span>
        </button>
      )}
      {((weak.length > 0 && onPromote !== undefined) || (drafts > 0 && onShowDrafts !== undefined) || waitlist > 0) && (
        <SettingsGroup title="Кабинет">
          {weak.length > 0 && onPromote !== undefined && (
            <button type="button" className="app-set-row" onClick={onPromote}>
              <span className="app-set-row-text">
                <span className="app-set-row-title">Продвинуть</span>
              </span>
              <span className="app-set-row-value">
                {weak.length}
                <ActionIcon name="chevron" size={16} strokeWidth={2.6} />
              </span>
            </button>
          )}
          {waitlist > 0 && (
            <div className="app-set-row">
              <span className="app-set-row-text">
                <span className="app-set-row-title">Лист ожидания</span>
              </span>
              <span className="app-set-row-value">{waitlist}</span>
            </div>
          )}
          {drafts > 0 && onShowDrafts !== undefined && (
            <button type="button" className="app-set-row" onClick={onShowDrafts}>
              <span className="app-set-row-text">
                <span className="app-set-row-title">Черновики</span>
              </span>
              <span className="app-set-row-value">
                {drafts}
                <ActionIcon name="chevron" size={16} strokeWidth={2.6} />
              </span>
            </button>
          )}
        </SettingsGroup>
      )}
    </section>
  );
}
