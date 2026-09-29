// START_MODULE_CONTRACT
// PURPOSE: Organizer «Статистика» tab — the account analytics screen: period, income hero, four counters, income chart, per-event bars, promo and mailing tiles, and the create-event button.
// SCOPE: The presentational screen and the snapshot behind the period switch and the chart window. Figures follow the cabinet mock; creating an event is handed back to the organizer space.
// DEPENDS: react, ../ui/icons.js, ../ui/theme.css, ./OrganizerFinance.js (formatRub)
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT

import { useState } from "react";
import { ActionIcon } from "../ui/icons";
import { useOrganizerNativeBack } from "./organizer-native-back";
import { CABINET_EVENTS, cabinetStats, defaultStatsRange, type CabinetStats } from "./cabinet-catalog";
import { formatRub } from "./OrganizerFinance";

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

function smoothLine(values: number[], max: number): string {
  if (values.length === 0 || max <= 0) return "";
  const pts = values.map((value, index) => ({
    x: values.length === 1 ? 0 : (index / (values.length - 1)) * 100,
    y: 100 - (Math.min(Math.max(value, 0), max) / max) * 100,
  }));
  let path = `M${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let index = 0; index < pts.length - 1; index += 1) {
    const p0 = pts[Math.max(index - 1, 0)];
    const p1 = pts[index];
    const p2 = pts[index + 1];
    const p3 = pts[Math.min(index + 2, pts.length - 1)];
    path += ` C${(p1.x + (p2.x - p0.x) / 6).toFixed(2)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(2)}, ${(p2.x - (p3.x - p1.x) / 6).toFixed(2)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return path;
}

function Delta({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span className={up ? "app-cab-delta" : "app-cab-delta app-cab-delta--down"}>
      {up ? "↑" : "↓"} {up ? "+" : "−"}
      {Math.abs(value)}%
    </span>
  );
}

function IncomeChart({ points }: { points: IncomePoint[] }) {
  const max = axisTop(points);
  const peak = chartPeak(points);
  const index = points.indexOf(peak);
  const left = Math.min(78, Math.max(22, points.length <= 1 ? 50 : (index / (points.length - 1)) * 100));
  const line = smoothLine(
    points.map((point) => point.value),
    max,
  );
  const ticks = [max, Math.round((max * 3) / 4), Math.round(max / 2), Math.round(max / 4), 0];
  return (
    <div className="app-cab-plot-wrap">
      <div className="app-cab-axis" aria-hidden="true">
        {ticks.map((tick) => (
          <span key={tick}>{tick.toLocaleString("ru-RU").replace(/\s/g, "\u00a0")}</span>
        ))}
      </div>
      <div className="app-cab-plot">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Динамика дохода">
          <defs>
            <linearGradient id="app-cab-income" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7a6cf8" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#7a6cf8" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4].map((row) => (
            <line key={row} x1="0" x2="100" y1={row * 25} y2={row * 25} className="app-cab-grid" />
          ))}
          <path d={`${line} L100 100 L0 100 Z`} fill="url(#app-cab-income)" />
          <path d={line} className="app-cab-line" />
        </svg>
        <span className="app-cab-tip" style={{ left: `${left}%` }}>
          <b>{formatRub(peak.value)}</b>
          <span>{peak.label}</span>
        </span>
      </div>
    </div>
  );
}

export function OrganizerStatistics(_props: { onCreateEvent?: () => void }) {
  const initial = defaultStatsRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [chartWindow, setChartWindow] = useState<StatsWindow>(7);
  const [notices, setNotices] = useState(false);
  const snapshot: CabinetStats = cabinetStats(CABINET_EVENTS, new Date(`${from}T00:00:00+03:00`), new Date(`${to}T23:59:59+03:00`));
  const points = INCOME_CHART[chartWindow];
  useOrganizerNativeBack(notices, () => setNotices(false));

  if (notices) {
    return (
      <section className="app-cab" aria-label="Уведомления">
        <h1 className="app-cab-title">Уведомления</h1>
        <ul className="app-cab-notices">
          {STATS_NOTICES.map((item) => (
            <li key={item.id}>
              <span className="app-cab-notice-title">{item.title}</span>
              <span className="app-cab-notice-when">{item.when}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section className="app-cab" aria-label="Статистика">
      <header className="app-cab-head">
        <h1 className="app-fin-title">Статистика</h1>
        <button type="button" className="app-cab-bell" aria-label="Уведомления" onClick={() => setNotices(true)}>
          <ActionIcon name="bell" size={20} strokeWidth={2} />
        </button>
      </header>
      <div className="app-cab-period-wrap">
        <button type="button" className="app-cab-period" aria-label="Диапазон дат" aria-expanded={calendarOpen} onClick={() => setCalendarOpen((open) => !open)}>
          <ActionIcon name="calendar" size={18} strokeWidth={2} />
          <span>
            {from.split("-").reverse().join(".")} — {to.split("-").reverse().join(".")}
          </span>
        </button>
        {calendarOpen && (
          <div className="app-cab-calendar" role="dialog" aria-label="Диапазон дат">
            <label className="app-fin-field">
              <span className="app-fin-field-label">С</span>
              <input className="app-fin-field-input" type="date" aria-label="Начало диапазона" value={from} onChange={(change) => setFrom(change.target.value)} />
            </label>
            <label className="app-fin-field">
              <span className="app-fin-field-label">По</span>
              <input className="app-fin-field-input" type="date" aria-label="Конец диапазона" value={to} onChange={(change) => setTo(change.target.value)} />
            </label>
            <div className="app-fin-periods">
              {STATS_WINDOWS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="app-fin-period"
                  onClick={() => {
                    const end = new Date(`${to}T12:00:00+03:00`);
                    const start = new Date(end.getTime() - item * 86_400_000);
                    setFrom(start.toISOString().slice(0, 10));
                    setCalendarOpen(false);
                  }}
                >
                  {item} дней
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <article className="app-fin-hero">
        <div className="app-fin-hero-copy">
          <p className="app-fin-hero-label">Общий доход</p>
          <p className="app-fin-hero-value">
            {formatRub(snapshot.incomeRub)}
            <span className={snapshot.delta >= 0 ? "app-fin-delta" : "app-fin-delta app-fin-delta--down"}>{snapshot.delta >= 0 ? `+${snapshot.delta}%` : `−${Math.abs(snapshot.delta)}%`}</span>
          </p>
          <p className="app-fin-hero-note">
            {from.split("-").reverse().join(".")} — {to.split("-").reverse().join(".")}
          </p>
        </div>
        <span className="app-fin-hero-wallet" aria-hidden="true">
          <ActionIcon name="wallet" size={22} strokeWidth={2} />
        </span>
      </article>
      <div className="app-cab-metrics">
        <article className="app-cab-metric">
          <span className="app-cab-metric-label">Всего событий</span>
          <b>{snapshot.events}</b>
          <Delta value={snapshot.eventsDelta} />
        </article>
        <article className="app-cab-metric">
          <span className="app-cab-metric-label">Продано билетов</span>
          <b>{snapshot.tickets.toLocaleString("ru-RU").replace(/\s/g, "\u00a0")}</b>
          <Delta value={snapshot.ticketsDelta} />
        </article>
        <article className="app-cab-metric">
          <span className="app-cab-metric-label">Средний чек</span>
          <b>{formatRub(snapshot.averageRub)}</b>
          <Delta value={snapshot.averageDelta} />
        </article>
        <article className="app-cab-metric">
          <span className="app-cab-metric-label">Конверсия</span>
          <b>{snapshot.conversion}%</b>
          <Delta value={snapshot.conversionDelta} />
        </article>
      </div>
      <article className="app-cab-card">
        <div className="app-cab-card-head">
          <h2 className="app-cab-card-title">Динамика дохода</h2>
          <div className="app-fin-periods" role="tablist" aria-label="Период графика">
            {STATS_WINDOWS.map((item) => (
              <button key={item} type="button" role="tab" aria-selected={chartWindow === item} className={chartWindow === item ? "app-fin-period app-fin-period--on" : "app-fin-period"} onClick={() => setChartWindow(item)}>
                {item} дней
              </button>
            ))}
          </div>
        </div>
        <IncomeChart points={points} />
        <div className="app-cab-dates" aria-hidden="true">
          {points.map((point) => (
            <span key={point.label}>{point.label}</span>
          ))}
        </div>
      </article>
      <article className="app-cab-card">
        <h2 className="app-cab-card-title">Статистика по событиям</h2>
        <ul className="app-cab-rows">
          {snapshot.rows.map((row) => (
            <li key={row.title}>
              <span className="app-cab-row-top">
                <span className="app-cab-row-name">
                  <i className={`app-cab-dot app-cab-dot--${row.tone}`} aria-hidden="true" />
                  {row.title}
                </span>
                <span className="app-cab-row-share">{row.percent}%</span>
                <span className="app-cab-row-money">{formatRub(row.amountRub)}</span>
              </span>
              <span className="app-cab-bar" aria-hidden="true">
                <span className={`app-cab-bar-fill app-cab-bar-fill--${row.tone}`} style={{ width: `${row.percent}%` }} />
              </span>
            </li>
          ))}
        </ul>
      </article>
      <div className="app-cab-pair">
        <article className="app-cab-mini">
          <span className="app-cab-mini-icon app-cab-mini-icon--promo" aria-hidden="true">
            <ActionIcon name="percent" size={16} strokeWidth={2.2} />
          </span>
          <span className="app-cab-mini-label">Активные промокоды</span>
          <b>{snapshot.promos}</b>
          <span className="app-cab-mini-note">
            Всего использований <strong>{snapshot.promoUses.toLocaleString("ru-RU").replace(/\s/g, "\u00a0")}</strong>
          </span>
        </article>
        <article className="app-cab-mini">
          <span className="app-cab-mini-icon app-cab-mini-icon--mail" aria-hidden="true">
            <ActionIcon name="mail" size={16} strokeWidth={2.2} />
          </span>
          <span className="app-cab-mini-label">Рассылки</span>
          <b>{snapshot.mailings}</b>
          <span className="app-cab-mini-note">
            Открываемость <strong>{snapshot.openRate}%</strong>
          </span>
        </article>
      </div>
    </section>
  );
}
