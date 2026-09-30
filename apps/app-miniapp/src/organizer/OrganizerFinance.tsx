// START_MODULE_CONTRACT
// PURPOSE: Organizer finance tab — the income dashboard from the cabinet mock: scope chips, period chart, recent operations and a withdrawal.
// SCOPE: Presentational screen plus the pure snapshot it renders. Figures are the cabinet ledger shown in the mock; a withdrawal updates that ledger on this device only.
// DEPENDS: react, ../ui/icons.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - FinanceScope - Общий доход | События | Промокоды
// - FinancePeriod - 7 | 30 | 90
// - financeView - the numbers, tiles, chart and operations for one scope and period
// - withdrawalBlock - why a withdrawal amount cannot be sent
// - createWithdrawal - the payout row a successful withdrawal prepends
// - OrganizerFinance - the tab: home, the full operation list, the withdrawal form
// END_MODULE_MAP

import { useState } from "react";
import { SettingsGroup } from "../profile/SettingsPage";
import { ActionIcon, type ActionIconName } from "../ui/icons";
import { AppButton, AppChip } from "../ui/primitives";
import { useOrganizerNativeBack } from "./organizer-native-back";

export type FinanceScope = "all" | "events" | "promocodes";
export type FinancePeriod = 7 | 30 | 90;
export type FinanceTone = "event" | "promo" | "partner";
export type FinanceKind = "ticket" | "fee" | "promo" | "payout" | "partner";

export interface FinanceTile {
  id: string;
  label: string;
  amountRub: number;
  percent: number;
  tone: FinanceTone;
}

export interface FinancePoint {
  label: string;
  income: number;
  payout: number;
}

export interface FinanceOperation {
  id: string;
  title: string;
  when: string;
  daysAgo: number;
  amountRub: number;
  kind: FinanceKind;
}

export interface FinanceView {
  totalRub: number;
  deltaPercent: number;
  tiles: FinanceTile[];
  points: FinancePoint[];
  operations: FinanceOperation[];
  availableRub: number;
}

export const FINANCE_SCOPES: Array<{ id: FinanceScope; label: string }> = [
  { id: "all", label: "Общий доход" },
  { id: "events", label: "События" },
  { id: "promocodes", label: "Промокоды" },
];

export const FINANCE_PERIODS: FinancePeriod[] = [7, 30, 90];

/** What the mock shows as free to withdraw before any new payout from this screen. */
export const FINANCE_AVAILABLE_RUB = 128_400;

const PREVIEW = 4;

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
};

const TILES: Record<FinancePeriod, Record<FinanceScope, FinanceTile[]>> = {
  30: {
    all: [
      { id: "events", label: "События", amountRub: 421_300, percent: 87, tone: "event" },
      { id: "promos", label: "Промокоды", amountRub: 36_450, percent: 7, tone: "promo" },
      { id: "partners", label: "Партнёрства", amountRub: 25_000, percent: 5, tone: "partner" },
    ],
    events: [
      { id: "jazz", label: "Джаз", amountRub: 186_400, percent: 44, tone: "event" },
      { id: "standup", label: "Стендап в парке", amountRub: 142_800, percent: 34, tone: "event" },
      { id: "yoga", label: "Йога на набережной", amountRub: 92_100, percent: 22, tone: "event" },
    ],
    promocodes: [
      { id: "autumn", label: "ОСЕНЬ2027", amountRub: 18_225, percent: 50, tone: "promo" },
      { id: "friend", label: "ДРУГ", amountRub: 10_935, percent: 30, tone: "promo" },
      { id: "early", label: "РАННИЙ", amountRub: 7_290, percent: 20, tone: "promo" },
    ],
  },
  7: {
    all: [
      { id: "events", label: "События", amountRub: 74_200, percent: 86, tone: "event" },
      { id: "promos", label: "Промокоды", amountRub: 8_200, percent: 9, tone: "promo" },
      { id: "partners", label: "Партнёрства", amountRub: 4_000, percent: 5, tone: "partner" },
    ],
    events: [
      { id: "jazz", label: "Джаз", amountRub: 32_820, percent: 44, tone: "event" },
      { id: "standup", label: "Стендап в парке", amountRub: 25_150, percent: 34, tone: "event" },
      { id: "yoga", label: "Йога на набережной", amountRub: 16_230, percent: 22, tone: "event" },
    ],
    promocodes: [
      { id: "autumn", label: "ОСЕНЬ2027", amountRub: 4_100, percent: 50, tone: "promo" },
      { id: "friend", label: "ДРУГ", amountRub: 2_460, percent: 30, tone: "promo" },
      { id: "early", label: "РАННИЙ", amountRub: 1_640, percent: 20, tone: "promo" },
    ],
  },
  90: {
    all: [
      { id: "events", label: "События", amountRub: 1_098_600, percent: 87, tone: "event" },
      { id: "promos", label: "Промокоды", amountRub: 98_600, percent: 8, tone: "promo" },
      { id: "partners", label: "Партнёрства", amountRub: 63_280, percent: 5, tone: "partner" },
    ],
    events: [
      { id: "jazz", label: "Джаз", amountRub: 483_384, percent: 44, tone: "event" },
      { id: "standup", label: "Стендап в парке", amountRub: 373_524, percent: 34, tone: "event" },
      { id: "yoga", label: "Йога на набережной", amountRub: 241_692, percent: 22, tone: "event" },
    ],
    promocodes: [
      { id: "autumn", label: "ОСЕНЬ2027", amountRub: 49_300, percent: 50, tone: "promo" },
      { id: "friend", label: "ДРУГ", amountRub: 29_580, percent: 30, tone: "promo" },
      { id: "early", label: "РАННИЙ", amountRub: 19_720, percent: 20, tone: "promo" },
    ],
  },
};

const WEEK: FinancePoint[] = [
  { label: "23.09", income: 14_000, payout: 8_000 },
  { label: "24.09", income: 9_000, payout: 16_000 },
  { label: "25.09", income: 17_000, payout: 6_000 },
  { label: "26.09", income: 11_000, payout: 18_000 },
  { label: "27.09", income: 20_000, payout: 12_000 },
  { label: "28.09", income: 13_000, payout: 19_000 },
  { label: "29.09", income: 22_000, payout: 15_000 },
];

const WEEK_SHORT: FinancePoint[] = [
  { label: "23.09", income: 8_000, payout: 4_000 },
  { label: "24.09", income: 6_000, payout: 9_000 },
  { label: "25.09", income: 11_000, payout: 3_000 },
  { label: "26.09", income: 7_000, payout: 10_000 },
  { label: "27.09", income: 12_000, payout: 6_000 },
  { label: "28.09", income: 9_000, payout: 11_000 },
  { label: "29.09", income: 14_000, payout: 8_000 },
];

const QUARTER: FinancePoint[] = [
  { label: "07.07", income: 18_000, payout: 9_000 },
  { label: "21.07", income: 22_000, payout: 14_000 },
  { label: "04.08", income: 16_000, payout: 12_000 },
  { label: "18.08", income: 26_000, payout: 15_000 },
  { label: "01.09", income: 21_000, payout: 17_000 },
  { label: "15.09", income: 28_000, payout: 16_000 },
  { label: "29.09", income: 24_000, payout: 19_000 },
];

const OPERATIONS: FinanceOperation[] = [
  { id: "jazz-ticket", title: "Билет на событие «Джаз»", when: "29.09 12:10", daysAgo: 0, amountRub: 1_200, kind: "ticket" },
  { id: "stripe", title: "Комиссия Stripe", when: "29.09 12:10", daysAgo: 0, amountRub: -184, kind: "fee" },
  { id: "autumn-op", title: "Промокод «ОСЕНЬ2027»", when: "29.09 18:45", daysAgo: 0, amountRub: 2_400, kind: "promo" },
  { id: "payout-sep", title: "Выплата организатору", when: "28.09 12:00", daysAgo: 1, amountRub: -15_000, kind: "payout" },
  { id: "standup-ticket", title: "Билет на событие «Стендап»", when: "27.09 19:40", daysAgo: 2, amountRub: 3_500, kind: "ticket" },
  { id: "partner-op", title: "Партнёрская программа", when: "26.09 11:00", daysAgo: 3, amountRub: 25_000, kind: "partner" },
  { id: "friend-op", title: "Промокод «ДРУГ»", when: "25.09 16:20", daysAgo: 4, amountRub: 1_800, kind: "promo" },
  { id: "yoga-ticket", title: "Билет на событие «Йога»", when: "24.09 09:05", daysAgo: 5, amountRub: 900, kind: "ticket" },
  { id: "payout-early", title: "Выплата организатору", when: "10.09 12:00", daysAgo: 19, amountRub: -40_000, kind: "payout" },
  { id: "jazz-august", title: "Билет на событие «Джаз»", when: "15.08 20:15", daysAgo: 45, amountRub: 2_200, kind: "ticket" },
];

const KIND_ICON: Record<FinanceKind, ActionIconName> = {
  ticket: "ticket",
  fee: "percent",
  promo: "tag",
  payout: "bell",
  partner: "users",
};

export const KIND_LABEL: Record<FinanceKind, string> = {
  ticket: "Билет",
  fee: "Комиссия",
  promo: "Промокод",
  payout: "Выплата",
  partner: "Партнёрство",
};

export function operationHint(kind: FinanceKind): string {
  if (kind === "ticket") return "Учёт записи на платное событие. Деньги получает ваш сайт.";
  if (kind === "fee") return "Комиссия платёжного провайдера.";
  if (kind === "promo") return "Начисление по промокоду.";
  if (kind === "payout") return "Вывод на реквизиты организации.";
  return "Партнёрское начисление.";
}

const TONE_ICON: Record<FinanceTone, ActionIconName> = {
  event: "ticket",
  promo: "tag",
  partner: "users",
};

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

export function axisMax(points: FinancePoint[]): number {
  const peak = Math.max(0, ...points.flatMap((point) => [point.income, point.payout]));
  return Math.max(10_000, Math.ceil(peak / 10_000) * 10_000);
}

/** Smooth line through the series, in a 0..100 box (y grows downward). */
export function smoothPath(values: number[], max: number): string {
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
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return path;
}

function inScope(kind: FinanceKind, scope: FinanceScope): boolean {
  if (kind === "payout") return true;
  if (scope === "all") return true;
  if (scope === "events") return kind === "ticket" || kind === "fee";
  return kind === "promo";
}

export function financeView(scope: FinanceScope, period: FinancePeriod, withdrawals: FinanceOperation[] = []): FinanceView {
  const points = (period === 7 ? WEEK_SHORT : period === 90 ? QUARTER : WEEK).map((point) => ({ ...point }));
  const withdrawn = withdrawals.reduce((sum, row) => sum + Math.abs(row.amountRub), 0);
  if (points.length > 0 && withdrawn > 0) points[points.length - 1].payout += withdrawn;
  return {
    totalRub: TOTALS[period][scope].total,
    deltaPercent: TOTALS[period][scope].delta,
    tiles: TILES[period][scope],
    points,
    operations: [...withdrawals, ...OPERATIONS.filter((row) => row.daysAgo < period && inScope(row.kind, scope))],
    availableRub: Math.max(0, FINANCE_AVAILABLE_RUB - withdrawn),
  };
}

export function parseWithdrawal(raw: string): number | null {
  const trimmed = raw.replace(/\s/g, "");
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value <= 0) return null;
  return value;
}

export function withdrawalBlock(raw: string, available: number): string | null {
  if (raw.trim() === "") return "Укажите сумму";
  const value = parseWithdrawal(raw);
  if (value === null) return "Сумма — целое число рублей";
  if (value > available) return "Сумма больше доступного остатка";
  return null;
}

export function createWithdrawal(amountRub: number, seq: number): FinanceOperation {
  return { id: `withdraw-${seq}`, title: "Выплата организатору", when: "29.09 21:00", daysAgo: 0, amountRub: -amountRub, kind: "payout" };
}

function FinanceChart({ points }: { points: FinancePoint[] }) {
  const max = axisMax(points);
  const ticks = [max, Math.round((max * 2) / 3), Math.round(max / 3), 0];
  return (
    <div className="app-fin-chart-body">
      <div className="app-fin-axis" aria-hidden="true">
        {ticks.map((tick) => (
          <span key={tick}>{formatAxis(tick)}</span>
        ))}
      </div>
      <svg className="app-fin-plot" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Доход и выплаты за период">
        {[0, 1, 2, 3].map((row) => (
          <line key={row} x1="0" x2="100" y1={row * (100 / 3)} y2={row * (100 / 3)} className="app-fin-grid" />
        ))}
        <path
          d={smoothPath(
            points.map((point) => point.income),
            max,
          )}
          className="app-fin-line app-fin-line--income"
        />
        <path
          d={smoothPath(
            points.map((point) => point.payout),
            max,
          )}
          className="app-fin-line app-fin-line--payout"
        />
      </svg>
    </div>
  );
}

function OperationRow({ row, onOpen }: { row: FinanceOperation; onOpen?: () => void }) {
  const incoming = row.amountRub > 0;
  const body = (
    <>
      <span className={`app-fin-op-icon app-fin-op-icon--${row.kind}`} aria-hidden="true">
        <ActionIcon name={KIND_ICON[row.kind]} size={18} strokeWidth={2.2} />
      </span>
      <span className="app-fin-op-text">
        <span className="app-fin-op-title">{row.title}</span>
        <span className="app-fin-op-when">{row.when}</span>
      </span>
      <span className={incoming ? "app-fin-op-amount app-fin-op-amount--in" : "app-fin-op-amount"}>{formatRub(row.amountRub, true)}</span>
    </>
  );
  if (onOpen === undefined) return <li className="app-fin-op">{body}</li>;
  return (
    <li>
      <button type="button" className="app-fin-op app-fin-op--btn" onClick={onOpen}>
        {body}
      </button>
    </li>
  );
}

export function OrganizerFinance() {
  const [period, setPeriod] = useState<FinancePeriod>(30);
  const [scope, setScope] = useState<FinanceScope>("all");
  const [screen, setScreen] = useState<"home" | "detail" | "withdraw">("home");
  const [opened, setOpened] = useState<FinanceOperation | null>(null);
  const [withdrawals, setWithdrawals] = useState<FinanceOperation[]>([]);
  const [amount, setAmount] = useState("");
  const [block, setBlock] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const view = financeView(scope, period, withdrawals);
  const operations = view.operations;
  useOrganizerNativeBack(screen !== "home", () => {
    setScreen("home");
    setOpened(null);
  });

  const submitWithdrawal = () => {
    const reason = withdrawalBlock(amount, view.availableRub);
    if (reason !== null) {
      setBlock(reason);
      return;
    }
    const value = parseWithdrawal(amount);
    if (value === null) return;
    setWithdrawals((current) => [createWithdrawal(value, current.length + 1), ...current]);
    setAmount("");
    setBlock(null);
    setNotice(`Заявка на вывод ${formatRub(value)} принята`);
    setScreen("home");
  };

  if (screen === "detail" && opened !== null) {
    return (
      <section className="app-gathering" aria-label="Операция">
        <h1 className="app-section-title">{KIND_LABEL[opened.kind]}</h1>
        <p className="app-fin-available">{formatRub(opened.amountRub, true)}</p>
        <p className="app-section-title">{opened.title}</p>
        <p>{opened.when}</p>
        <p>{operationHint(opened.kind)}</p>
      </section>
    );
  }

  if (screen === "withdraw") {
    return (
      <section className="app-gathering" aria-label="Вывести средства">
        <h1 className="app-section-title">Вывести средства</h1>
        <p className="app-fin-available">{formatRub(view.availableRub)}</p>
        <label className="app-org-field">
          <span className="app-org-field-label">Сумма</span>
          <input
            className="app-profile-input"
            inputMode="numeric"
            placeholder="0"
            value={amount}
            onChange={(change) => {
              setAmount(change.target.value);
              setBlock(null);
            }}
          />
        </label>
        {block !== null && <p className="app-fin-block">{block}</p>}
        <AppButton stretched onClick={submitWithdrawal}>
          Вывести
        </AppButton>
      </section>
    );
  }

  return (
    <section className="app-gathering" aria-label="Финансы">
      <h1 className="app-section-title">Финансы</h1>
      {notice !== null && <p className="app-fin-notice">{notice}</p>}
      <div className="app-org-tiles">
        <button type="button" className="app-org-tile" onClick={() => setScreen("withdraw")}>
          <span className="app-org-tile-label">К выводу</span>
          <span className="app-org-tile-big">{formatRub(view.availableRub)}</span>
        </button>
        <button type="button" className="app-org-tile" onClick={() => setScope("all")}>
          <span className="app-org-tile-label">Учтено</span>
          <span className="app-org-tile-big">{formatRub(view.totalRub)}</span>
        </button>
      </div>
      <div className="app-filters-chips" role="group" aria-label="Период">
        {FINANCE_PERIODS.map((item) => (
          <AppChip key={item} pressed={period === item} onClick={() => setPeriod(item)}>
            {item} дней
          </AppChip>
        ))}
      </div>
      <div className="app-org-tiles">
        {view.tiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            className="app-org-tile"
            onClick={() => setScope(tile.tone === "promo" ? "promocodes" : tile.tone === "event" ? "events" : "all")}
          >
            <span className="app-org-tile-label">{tile.label}</span>
            <span className="app-org-tile-big">{formatRub(tile.amountRub)}</span>
          </button>
        ))}
      </div>
      <SettingsGroup title="Операции">
        {operations.length === 0 && (
          <div className="app-set-row">
            <span className="app-set-row-text">
              <span className="app-set-row-title">За этот период пусто</span>
            </span>
          </div>
        )}
        {operations.map((row) => (
          <button
            key={row.id}
            type="button"
            className="app-set-row"
            onClick={() => {
              setOpened(row);
              setScreen("detail");
            }}
          >
            <span className="app-set-row-text">
              <span className="app-set-row-title">{row.title}</span>
            </span>
            <span className={row.amountRub > 0 ? "app-fin-op-amount app-fin-op-amount--in" : "app-fin-op-amount"}>{formatRub(row.amountRub, true)}</span>
          </button>
        ))}
      </SettingsGroup>
      <AppButton
        stretched
        onClick={() => {
          setBlock(null);
          setScreen("withdraw");
        }}
      >
        Вывести средства
      </AppButton>
    </section>
  );
}
