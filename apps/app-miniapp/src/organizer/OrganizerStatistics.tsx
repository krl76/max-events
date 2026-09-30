// START_MODULE_CONTRACT
// PURPOSE: Organizer «Статистика» tab — CRM home: period, registrations hero, occupancy ring, attendance, weekday chart, traffic sources, today’s door, and cabinet actions.
// SCOPE: Presentational screen over the cabinet mock. Occupancy is one aggregate visual; per-event fill lives on the event hub. Rubles stay on Finance.
// DEPENDS: react, ../ui/icons.js, ../ui/theme.css, ./cabinet-catalog.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT

import { useState } from "react";
import type { OrganizerEvent } from "../api/client";
import { SettingsGroup } from "../profile/SettingsPage";
import { ActionIcon } from "../ui/icons";
import { pictured } from "../ui/photos";
import { AppChip, AppMedia } from "../ui/primitives";
import { CABINET_ATTENDED_PERCENT, CABINET_EVENTS, CABINET_TRAFFIC, CABINET_TRAFFIC_LABELS, cabinetAsOrganizerEvent, cabinetOccupancy, cabinetStats, cabinetTrafficLead, cabinetWeakUpcoming, cabinetWeekdayBookings, defaultStatsRange, fillCaption } from "./cabinet-catalog";
import { useOrganizerNativeBack } from "./organizer-native-back";

const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"] as const;
const RING = 2 * Math.PI * 28;

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

function OccupancyRing({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <span className="app-org-ring-wrap">
      <svg className="app-org-ring" viewBox="0 0 72 72" aria-hidden="true">
        <circle className="app-org-ring-track" cx="36" cy="36" r="28" />
        <circle className="app-org-ring-fill" cx="36" cy="36" r="28" strokeDasharray={RING} strokeDashoffset={RING * (1 - clamped / 100)} />
      </svg>
      <span className="app-org-ring-value">{clamped}%</span>
    </span>
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

export const STATS_NOTICES = [
  { id: "jazz", title: "Новая запись на «Вечер джаза»", when: "2 ч назад" },
  { id: "code", title: "Промокод ОСЕНЬ2027 использовали 12 раз", when: "вчера" },
  { id: "reach", title: "Охват ленты вырос на 28%", when: "29.09" },
] as const;

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

export function OrganizerStatistics({ onCheckIn, onShowDrafts, onPromote }: { onCreateEvent?: () => void; onOpenEvent?: (event: OrganizerEvent) => void; onCheckIn?: (event: OrganizerEvent) => void; onShowDrafts?: () => void; onPromote?: () => void }) {
  const initial = defaultStatsRange();
  const [days, setDays] = useState<StatsWindow>(30);
  const [to] = useState(initial.to);
  const from = new Date(new Date(`${to}T12:00:00+03:00`).getTime() - days * 86_400_000).toISOString().slice(0, 10);
  const [pane, setPane] = useState<"home" | "notices">("home");
  const rangeFrom = new Date(`${from}T00:00:00+03:00`);
  const rangeTo = new Date(`${to}T23:59:59+03:00`);
  const now = new Date(`${to}T12:00:00+03:00`);
  const snapshot = cabinetStats(CABINET_EVENTS, rangeFrom, rangeTo);
  const occupancy = cabinetOccupancy(CABINET_EVENTS, rangeFrom, rangeTo);
  const weak = cabinetWeakUpcoming(CABINET_EVENTS, now);
  const today = CABINET_EVENTS.find((item) => !item.draft && item.startsAt.slice(0, 10) === to);
  const drafts = CABINET_EVENTS.filter((item) => item.draft).length;
  const weekdays = cabinetWeekdayBookings(CABINET_EVENTS, rangeFrom, rangeTo);
  const trafficLead = cabinetTrafficLead();
  useOrganizerNativeBack(pane !== "home", () => setPane("home"));

  if (pane === "notices") {
    return (
      <section className="app-gathering" aria-label="Уведомления">
        <h1 className="app-section-title">Уведомления</h1>
        <SettingsGroup title="Кабинет">
          {STATS_NOTICES.map((item) => (
            <div key={item.id} className="app-set-row">
              <span className="app-set-row-text">
                <span className="app-set-row-title">{item.title}</span>
                <span className="app-set-row-hint">{item.when}</span>
              </span>
            </div>
          ))}
        </SettingsGroup>
      </section>
    );
  }

  return (
    <section className="app-gathering" aria-label="Статистика">
      <div className="app-org-head">
        <h1 className="app-section-title">Статистика</h1>
        <button type="button" className="app-org-head-link" onClick={() => setPane("notices")}>
          Уведомления
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
        <span className="app-org-kpi-value">{countLabel(snapshot.tickets)}</span>
        <span className="app-org-kpi-label">регистрации</span>
      </div>
      <div className="app-org-ways">
        <div className="app-org-way app-org-way--dark">
          <span className="app-org-way-head">
            <OccupancyRing percent={occupancy.fill} />
            <span className="app-org-way-copy">
              <span className="app-org-way-label">Заполняемость</span>
              <span className="app-org-way-note">{fillCaption(occupancy.booked, occupancy.capacity, occupancy.fill)}</span>
            </span>
          </span>
        </div>
        <div className="app-org-way">
          <span className="app-org-way-value">{CABINET_ATTENDED_PERCENT}%</span>
          <span className="app-org-way-label">Дошли до входа</span>
          <span className="app-org-way-note">из {countLabel(snapshot.tickets)} записей</span>
        </div>
      </div>
      <div className="app-org-chart">
        <span className="app-org-chart-title">Регистрации по дням недели</span>
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
        <span className="app-org-chart-title">{trafficLead}</span>
        {CABINET_TRAFFIC.map((row) => (
          <div key={row.source} className="app-org-source">
            <span className="app-org-source-label">{CABINET_TRAFFIC_LABELS[row.source]}</span>
            <span className="app-org-source-track" aria-hidden="true">
              <span className={`app-org-source-fill app-org-source-fill--${row.source}`} style={{ width: `${row.percent}%` }} />
            </span>
            <span className="app-org-source-value">{row.percent}%</span>
          </div>
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
      {((weak.length > 0 && onPromote !== undefined) || (drafts > 0 && onShowDrafts !== undefined)) && (
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
