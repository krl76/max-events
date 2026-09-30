// START_MODULE_CONTRACT
// PURPOSE: Organizer finance tab — the income dashboard from the cabinet mock: scope chips, hero, source tiles, income chart, expense donut and payout history.
// SCOPE: Presentational screen plus the pure snapshot it renders. Figures are the cabinet ledger shown in the mock.
// DEPENDS: react, ../ui/icons.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - FinanceScope - Общий доход | События | Промокоды
// - FinancePeriod - 7 | 30 | 90 | 365 (Год)
// - financeView - the numbers, tiles, chart, expenses and payouts for one scope and period
// - OrganizerFinance - the tab
// END_MODULE_MAP

import { useState } from "react";
import { ActionIcon, type ActionIconName } from "../ui/icons";

export type FinanceScope = "all" | "events" | "promocodes";
export type FinancePeriod = 7 | 30 | 90 | 365;
export type FinanceTone = "blue" | "violet";
export type PayoutStatus = "paid" | "charged";

export interface FinanceTile {
  id: string;
  label: string;
  amountRub: number;
  percent: number;
  icon: ActionIconName;
  tone: FinanceTone;
}

export interface CurvePoint {
  x: number;
  y: number;
}

export interface FinanceExpense {
  id: string;
  label: string;
  percent: number;
  amountRub: number;
  /** The figure printed at the right of the row. On the mock it is not always the same number as percent. */
  mark: number;
  color: string;
}

export interface FinancePayout {
  id: string;
  title: string;
  when: string;
  daysAgo: number;
  amountRub: number;
  status: PayoutStatus;
  icon: ActionIconName;
  tone: FinanceTone;
}

export interface FinanceSeries {
  labels: string[];
  income: CurvePoint[];
  payout: CurvePoint[];
}

export interface FinanceView {
  heroLabel: string;
  note: string;
  totalRub: number;
  deltaPercent: number;
  tiles: FinanceTile[];
  series: FinanceSeries;
  expenses: FinanceExpense[];
  expenseTotalRub: number;
  payouts: FinancePayout[];
}

export const FINANCE_SCOPES: Array<{ id: FinanceScope; label: string }> = [
  { id: "all", label: "Общий доход" },
  { id: "events", label: "События" },
  { id: "promocodes", label: "Промокоды" },
];

export const FINANCE_PERIODS: Array<{ id: FinancePeriod; label: string }> = [
  { id: 7, label: "7 дней" },
  { id: 30, label: "30 дней" },
  { id: 90, label: "90 дней" },
  { id: 365, label: "Год" },
];

export const FINANCE_AXIS_MAX = 30_000;

const SCOPE_LABEL: Record<FinanceScope, string> = {
  all: "Общий доход",
  events: "События",
  promocodes: "Промокоды",
};

const TOTALS: Record<FinancePeriod, Record<FinanceScope, { total: number; delta: number }>> = {
  7: {
    all: { total: 86_400, delta: 11 },
    events: { total: 74_200, delta: 9 },
    promocodes: { total: 8_200, delta: 4 },
  },
  30: {
    all: { total: 482_750, delta: 24 },
    events: { total: 421_300, delta: 21 },
    promocodes: { total: 36_450, delta: 16 },
  },
  90: {
    all: { total: 1_260_480, delta: 18 },
    events: { total: 1_098_600, delta: 15 },
    promocodes: { total: 98_600, delta: 22 },
  },
  365: {
    all: { total: 5_240_000, delta: 19 },
    events: { total: 4_560_000, delta: 17 },
    promocodes: { total: 410_000, delta: 28 },
  },
};

const TILES: Record<FinancePeriod, Record<FinanceScope, FinanceTile[]>> = {
  30: {
    all: [
      { id: "events", label: "События", amountRub: 421_300, percent: 87, icon: "info", tone: "blue" },
      { id: "promos", label: "Промокоды", amountRub: 36_450, percent: 7, icon: "megaphone", tone: "violet" },
      { id: "partners", label: "Партнёрства", amountRub: 25_000, percent: 5, icon: "nodes", tone: "blue" },
    ],
    events: [
      { id: "jazz", label: "Джаз", amountRub: 186_400, percent: 44, icon: "calendar", tone: "blue" },
      { id: "standup", label: "Стендап в парке", amountRub: 142_800, percent: 34, icon: "ticket", tone: "violet" },
      { id: "yoga", label: "Йога на набережной", amountRub: 92_100, percent: 22, icon: "twinkle", tone: "blue" },
    ],
    promocodes: [
      { id: "autumn", label: "ОСЕНЬ2027", amountRub: 18_225, percent: 50, icon: "megaphone", tone: "violet" },
      { id: "friend", label: "ДРУГ", amountRub: 10_935, percent: 30, icon: "megaphone", tone: "violet" },
      { id: "early", label: "РАННИЙ", amountRub: 7_290, percent: 20, icon: "megaphone", tone: "blue" },
    ],
  },
  7: {
    all: [
      { id: "events", label: "События", amountRub: 74_200, percent: 86, icon: "info", tone: "blue" },
      { id: "promos", label: "Промокоды", amountRub: 8_200, percent: 9, icon: "megaphone", tone: "violet" },
      { id: "partners", label: "Партнёрства", amountRub: 4_000, percent: 5, icon: "nodes", tone: "blue" },
    ],
    events: [
      { id: "jazz", label: "Джаз", amountRub: 32_820, percent: 44, icon: "calendar", tone: "blue" },
      { id: "standup", label: "Стендап в парке", amountRub: 25_150, percent: 34, icon: "ticket", tone: "violet" },
      { id: "yoga", label: "Йога на набережной", amountRub: 16_230, percent: 22, icon: "twinkle", tone: "blue" },
    ],
    promocodes: [
      { id: "autumn", label: "ОСЕНЬ2027", amountRub: 4_100, percent: 50, icon: "megaphone", tone: "violet" },
      { id: "friend", label: "ДРУГ", amountRub: 2_460, percent: 30, icon: "megaphone", tone: "violet" },
      { id: "early", label: "РАННИЙ", amountRub: 1_640, percent: 20, icon: "megaphone", tone: "blue" },
    ],
  },
  90: {
    all: [
      { id: "events", label: "События", amountRub: 1_098_600, percent: 87, icon: "info", tone: "blue" },
      { id: "promos", label: "Промокоды", amountRub: 98_600, percent: 8, icon: "megaphone", tone: "violet" },
      { id: "partners", label: "Партнёрства", amountRub: 63_280, percent: 5, icon: "nodes", tone: "blue" },
    ],
    events: [
      { id: "jazz", label: "Джаз", amountRub: 483_384, percent: 44, icon: "calendar", tone: "blue" },
      { id: "standup", label: "Стендап в парке", amountRub: 373_524, percent: 34, icon: "ticket", tone: "violet" },
      { id: "yoga", label: "Йога на набережной", amountRub: 241_692, percent: 22, icon: "twinkle", tone: "blue" },
    ],
    promocodes: [
      { id: "autumn", label: "ОСЕНЬ2027", amountRub: 49_300, percent: 50, icon: "megaphone", tone: "violet" },
      { id: "friend", label: "ДРУГ", amountRub: 29_580, percent: 30, icon: "megaphone", tone: "violet" },
      { id: "early", label: "РАННИЙ", amountRub: 19_720, percent: 20, icon: "megaphone", tone: "blue" },
    ],
  },
  365: {
    all: [
      { id: "events", label: "События", amountRub: 4_560_000, percent: 87, icon: "info", tone: "blue" },
      { id: "promos", label: "Промокоды", amountRub: 410_000, percent: 8, icon: "megaphone", tone: "violet" },
      { id: "partners", label: "Партнёрства", amountRub: 270_000, percent: 5, icon: "nodes", tone: "blue" },
    ],
    events: [
      { id: "jazz", label: "Джаз", amountRub: 2_006_400, percent: 44, icon: "calendar", tone: "blue" },
      { id: "standup", label: "Стендап в парке", amountRub: 1_550_400, percent: 34, icon: "ticket", tone: "violet" },
      { id: "yoga", label: "Йога на набережной", amountRub: 1_003_200, percent: 22, icon: "twinkle", tone: "blue" },
    ],
    promocodes: [
      { id: "autumn", label: "ОСЕНЬ2027", amountRub: 205_000, percent: 50, icon: "megaphone", tone: "violet" },
      { id: "friend", label: "ДРУГ", amountRub: 123_000, percent: 30, icon: "megaphone", tone: "violet" },
      { id: "early", label: "РАННИЙ", amountRub: 82_000, percent: 20, icon: "megaphone", tone: "blue" },
    ],
  },
};

const WEEK_LABELS = ["23.09", "24.09", "25.09", "26.09", "27.09", "28.09", "29.09"];

/** The 30-day line on the mock: peaks sit between the date ticks, so the series is denser than the labels. */
const PHOTO_INCOME: CurvePoint[] = [
  { x: 0, y: 7_200 },
  { x: 0.62, y: 14_200 },
  { x: 1.25, y: 10_600 },
  { x: 2.05, y: 6_700 },
  { x: 3, y: 11_100 },
  { x: 4.35, y: 20_600 },
  { x: 5.05, y: 13_700 },
  { x: 6, y: 20_800 },
];

const PHOTO_PAYOUT: CurvePoint[] = [
  { x: 0, y: 7_500 },
  { x: 1.05, y: 12_200 },
  { x: 2.1, y: 17_200 },
  { x: 3, y: 11_000 },
  { x: 3.62, y: 6_800 },
  { x: 4.25, y: 10_000 },
  { x: 5.15, y: 10_300 },
  { x: 6, y: 13_200 },
];

const SERIES: Record<FinancePeriod, FinanceSeries> = {
  30: { labels: WEEK_LABELS, income: PHOTO_INCOME, payout: PHOTO_PAYOUT },
  7: {
    labels: WEEK_LABELS,
    income: [
      { x: 0, y: 5_400 },
      { x: 1, y: 9_200 },
      { x: 2, y: 6_100 },
      { x: 3, y: 12_400 },
      { x: 4, y: 8_800 },
      { x: 5, y: 11_600 },
      { x: 6, y: 15_200 },
    ],
    payout: [
      { x: 0, y: 4_800 },
      { x: 1, y: 8_400 },
      { x: 2, y: 11_800 },
      { x: 3, y: 7_200 },
      { x: 4, y: 6_400 },
      { x: 5, y: 9_100 },
      { x: 6, y: 10_400 },
    ],
  },
  90: {
    labels: ["07.07", "21.07", "04.08", "18.08", "01.09", "15.09", "29.09"],
    income: [
      { x: 0, y: 9_200 },
      { x: 1, y: 16_400 },
      { x: 2, y: 12_200 },
      { x: 3, y: 18_600 },
      { x: 4, y: 11_400 },
      { x: 5, y: 19_800 },
      { x: 6, y: 22_400 },
    ],
    payout: [
      { x: 0, y: 8_100 },
      { x: 1, y: 11_200 },
      { x: 2, y: 15_600 },
      { x: 3, y: 9_400 },
      { x: 4, y: 13_200 },
      { x: 5, y: 10_800 },
      { x: 6, y: 14_600 },
    ],
  },
  365: {
    labels: ["янв", "мар", "май", "июл", "сен", "ноя", "дек"],
    income: [
      { x: 0, y: 8_400 },
      { x: 1, y: 12_800 },
      { x: 2, y: 11_200 },
      { x: 3, y: 17_400 },
      { x: 4, y: 14_600 },
      { x: 5, y: 19_200 },
      { x: 6, y: 23_600 },
    ],
    payout: [
      { x: 0, y: 6_200 },
      { x: 1, y: 9_800 },
      { x: 2, y: 13_400 },
      { x: 3, y: 8_600 },
      { x: 4, y: 12_200 },
      { x: 5, y: 11_400 },
      { x: 6, y: 15_800 },
    ],
  },
};

const EXPENSES: FinanceExpense[] = [
  { id: "fee", label: "Комиссии платформы", percent: 42, amountRub: 28_750, mark: 42, color: "#6d35f5" },
  { id: "ads", label: "Реклама и продвижение", percent: 21, amountRub: 14_380, mark: 12, color: "#a45cff" },
  { id: "promo", label: "Промокоды", percent: 15, amountRub: 10_200, mark: 19, color: "#7a62ff" },
  { id: "org", label: "Организация", percent: 12, amountRub: 8_220, mark: 12, color: "#2f86ff" },
  { id: "other", label: "Прочее", percent: 10, amountRub: 6_870, mark: 10, color: "#b7d2fb" },
];

const PAYOUTS: FinancePayout[] = [
  { id: "event-28", title: "Выплата за события", when: "28.09.2025", daysAgo: 1, amountRub: 120_000, status: "paid", icon: "twinkle", tone: "blue" },
  { id: "fee-28", title: "Комиссия платформы", when: "28.09.2025", daysAgo: 1, amountRub: -18_400, status: "charged", icon: "nodes", tone: "violet" },
  { id: "refund-26", title: "Возврат билетов", when: "26.09.2025", daysAgo: 3, amountRub: -7_200, status: "charged", icon: "cloud", tone: "violet" },
  { id: "event-20", title: "Выплата за события", when: "20.09.2025", daysAgo: 9, amountRub: 95_500, status: "paid", icon: "wallet", tone: "blue" },
  { id: "fee-20", title: "Комиссия платформы", when: "20.09.2025", daysAgo: 9, amountRub: -14_800, status: "charged", icon: "twinkle", tone: "violet" },
  { id: "event-12", title: "Выплата за события", when: "12.08.2025", daysAgo: 48, amountRub: 64_000, status: "paid", icon: "wallet", tone: "blue" },
];

const STATUS_LABEL: Record<PayoutStatus, string> = {
  paid: "Выплачено",
  charged: "Списано",
};

const PLOT_W = 300;
const PLOT_H = 132;
const DONUT_R = 32;
const DONUT_C = 2 * Math.PI * DONUT_R;
const DONUT_GAP = 3.2;

export function formatRub(value: number, signed = false): string {
  const body = `${Math.abs(value).toLocaleString("ru-RU").replace(/\s/g, "\u00a0")}\u00a0₽`;
  if (!signed || value === 0) return body;
  return `${value > 0 ? "+" : "−"}${body}`;
}

export function formatDelta(percent: number): string {
  if (percent > 0) return `+${percent}%`;
  if (percent < 0) return `−${Math.abs(percent)}%`;
  return "0%";
}

export function formatAxis(value: number): string {
  return value.toLocaleString("ru-RU").replace(/\s/g, "\u00a0");
}

export function periodNote(period: FinancePeriod): string {
  if (period === 365) return "за последний год";
  return `за последние ${period} дней`;
}

function plotPoint(point: CurvePoint): { x: number; y: number } {
  return {
    x: (point.x / 6) * PLOT_W,
    y: PLOT_H - (Math.min(Math.max(point.y, 0), FINANCE_AXIS_MAX) / FINANCE_AXIS_MAX) * PLOT_H,
  };
}

export function smoothPath(points: CurvePoint[]): string {
  const pts = points.map(plotPoint);
  if (pts.length === 0) return "";
  let path = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let index = 0; index < pts.length - 1; index += 1) {
    const p0 = pts[Math.max(index - 1, 0)];
    const p1 = pts[index];
    const p2 = pts[index + 1];
    const p3 = pts[Math.min(index + 2, pts.length - 1)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return path;
}

function areaPath(points: CurvePoint[]): string {
  const line = smoothPath(points);
  if (line === "" || points.length === 0) return "";
  const first = plotPoint(points[0]);
  const last = plotPoint(points[points.length - 1]);
  return `${line} L${last.x.toFixed(1)} ${PLOT_H} L${first.x.toFixed(1)} ${PLOT_H} Z`;
}

function expensesFor(period: FinancePeriod): FinanceExpense[] {
  const factor = TOTALS[period].all.total / TOTALS[30].all.total;
  return EXPENSES.map((item) => ({ ...item, amountRub: Math.round(item.amountRub * factor) }));
}

export function financeView(scope: FinanceScope, period: FinancePeriod): FinanceView {
  const expenses = expensesFor(period);
  return {
    heroLabel: SCOPE_LABEL[scope],
    note: periodNote(period),
    totalRub: TOTALS[period][scope].total,
    deltaPercent: TOTALS[period][scope].delta,
    tiles: TILES[period][scope],
    series: SERIES[period],
    expenses,
    expenseTotalRub: expenses.reduce((sum, item) => sum + item.amountRub, 0),
    payouts: PAYOUTS.filter((row) => row.daysAgo < period),
  };
}

function PeriodSwitch({ period, onPeriod }: { period: FinancePeriod; onPeriod: (period: FinancePeriod) => void }) {
  return (
    <div className="app-fin-switch" role="group" aria-label="Период">
      {FINANCE_PERIODS.map((item) => (
        <button key={item.id} type="button" className={period === item.id ? "app-fin-switch-btn app-fin-switch-btn--on" : "app-fin-switch-btn"} aria-pressed={period === item.id} onClick={() => onPeriod(item.id)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

function FinanceChart({ series }: { series: FinanceSeries }) {
  const ticks = [FINANCE_AXIS_MAX, 20_000, 10_000, 0];
  const income = smoothPath(series.income);
  const payout = smoothPath(series.payout);
  const ends = [series.income[0], series.income[series.income.length - 1], series.payout[0], series.payout[series.payout.length - 1]];
  return (
    <div className="app-fin-chart">
      <div className="app-fin-axis" aria-hidden="true">
        {ticks.map((tick) => (
          <span key={tick}>{formatAxis(tick)}</span>
        ))}
      </div>
      <svg className="app-fin-plot" viewBox={`0 0 ${PLOT_W} ${PLOT_H}`} role="img" aria-label="Доход и выплаты за период">
        <defs>
          <linearGradient id="app-fin-income-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6d5efc" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#6d5efc" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => {
          const y = PLOT_H - (tick / FINANCE_AXIS_MAX) * PLOT_H;
          return <line key={tick} x1="0" x2={PLOT_W} y1={y} y2={y} className="app-fin-grid" />;
        })}
        {series.labels.map((label, index) => {
          const x = (index / (series.labels.length - 1)) * PLOT_W;
          return <line key={label} x1={x} x2={x} y1="0" y2={PLOT_H} className="app-fin-grid" />;
        })}
        <path d={areaPath(series.income)} fill="url(#app-fin-income-fill)" />
        <path d={payout} className="app-fin-line app-fin-line--payout" />
        <path d={income} className="app-fin-line app-fin-line--income" />
        {ends.map((point, index) => {
          if (point === undefined) return null;
          const dot = plotPoint(point);
          return <circle key={index} cx={dot.x} cy={dot.y} r="3.4" className={index < 2 ? "app-fin-dot-mark app-fin-dot-mark--income" : "app-fin-dot-mark app-fin-dot-mark--payout"} />;
        })}
      </svg>
      <div className="app-fin-dates">
        {series.labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}

function ExpenseDonut({ expenses }: { expenses: FinanceExpense[] }) {
  let cursor = 0;
  return (
    <div className="app-fin-donut">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        {expenses.map((item) => {
          const length = (item.percent / 100) * DONUT_C;
          const dash = Math.max(0, length - DONUT_GAP);
          const offset = DONUT_C / 4 - cursor;
          cursor += length;
          return <circle key={item.id} cx="50" cy="50" r={DONUT_R} fill="none" stroke={item.color} strokeWidth="13" strokeDasharray={`${dash} ${DONUT_C - dash}`} strokeDashoffset={offset} />;
        })}
      </svg>
    </div>
  );
}

export function OrganizerFinance() {
  const [period, setPeriod] = useState<FinancePeriod>(30);
  const [scope, setScope] = useState<FinanceScope>("all");
  const view = financeView(scope, period);

  return (
    <section className="app-cab app-fin" aria-label="Финансы">
      <h1 className="app-fin-title">Финансы</h1>
      <p className="app-fin-lead">Доходы, выплаты и аналитика</p>
      <div className="app-fin-scopes" role="group" aria-label="Срез дохода">
        {FINANCE_SCOPES.map((item) => (
          <button key={item.id} type="button" className={scope === item.id ? "app-fin-chip app-fin-chip--on" : "app-fin-chip"} aria-pressed={scope === item.id} onClick={() => setScope(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <article className="app-fin-hero">
        <div className="app-fin-hero-copy">
          <p className="app-fin-hero-label">{view.heroLabel}</p>
          <p className="app-fin-hero-value">
            {formatRub(view.totalRub)}
            <span className={view.deltaPercent < 0 ? "app-fin-delta app-fin-delta--down" : "app-fin-delta"}>
              <ActionIcon name="up" size={14} strokeWidth={2.6} />
              {formatDelta(view.deltaPercent)}
            </span>
          </p>
          <p className="app-fin-hero-note">{view.note}</p>
        </div>
        <span className="app-fin-hero-wallet" aria-hidden="true">
          <ActionIcon name="wallet" size={22} strokeWidth={1.8} />
        </span>
      </article>
      <div className="app-fin-tiles">
        {view.tiles.map((tile) => (
          <article key={tile.id} className="app-fin-tile">
            <span className={`app-fin-tile-icon app-fin-tile-icon--${tile.tone}`} aria-hidden="true">
              <ActionIcon name={tile.icon} size={18} strokeWidth={2} />
            </span>
            <span className="app-fin-tile-label">{tile.label}</span>
            <span className="app-fin-tile-amount">{formatRub(tile.amountRub)}</span>
            <span className="app-fin-tile-share">{tile.percent}%</span>
          </article>
        ))}
      </div>
      <article className="app-fin-card">
        <h2 className="app-fin-card-title">Динамика выплат и доходов</h2>
        <PeriodSwitch period={period} onPeriod={setPeriod} />
        <p className="app-fin-legend">
          <span className="app-fin-legend-item">
            <i className="app-fin-dot app-fin-dot--income" />
            Доход
          </span>
          <span className="app-fin-legend-item">
            <i className="app-fin-dot app-fin-dot--payout" />
            Выплаты
          </span>
        </p>
        <FinanceChart series={view.series} />
      </article>
      <article className="app-fin-card">
        <h2 className="app-fin-card-title">Категории расходов</h2>
        <div className="app-fin-exp">
          <div className="app-fin-donut-wrap">
            <ExpenseDonut expenses={view.expenses} />
            <div className="app-fin-donut-mid">
              <b>{formatRub(view.expenseTotalRub)}</b>
              <span>итого</span>
            </div>
          </div>
          <ul className="app-fin-exp-list">
            {view.expenses.map((item) => (
              <li key={item.id} className="app-fin-exp-row">
                <i className="app-fin-exp-dot" style={{ background: item.color }} />
                <span className="app-fin-exp-copy">
                  <span className="app-fin-exp-name">{item.label}</span>
                  <span className="app-fin-exp-meta">
                    {item.percent}% {formatRub(item.amountRub)}
                  </span>
                </span>
                <span className="app-fin-exp-mark">{item.mark}%</span>
              </li>
            ))}
          </ul>
        </div>
      </article>
      <article className="app-fin-card">
        <h2 className="app-fin-card-title">История выплат</h2>
        {view.payouts.length === 0 ? (
          <p className="app-fin-empty">За этот период выплат нет</p>
        ) : (
          <ul className="app-fin-pays">
            {view.payouts.map((row) => (
              <li key={row.id} className="app-fin-pay">
                <span className={`app-fin-pay-icon app-fin-pay-icon--${row.tone}`} aria-hidden="true">
                  <ActionIcon name={row.icon} size={18} strokeWidth={2} />
                </span>
                <span className="app-fin-pay-copy">
                  <span className="app-fin-pay-title">{row.title}</span>
                  <span className="app-fin-pay-amount">{formatRub(row.amountRub, true)}</span>
                  <span className="app-fin-pay-when">{row.when}</span>
                </span>
                <span className={row.status === "paid" ? "app-fin-badge app-fin-badge--paid" : "app-fin-badge app-fin-badge--charged"}>{STATUS_LABEL[row.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </article>
      <PeriodSwitch period={period} onPeriod={setPeriod} />
    </section>
  );
}
