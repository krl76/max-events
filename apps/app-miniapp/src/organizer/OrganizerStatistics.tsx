// START_MODULE_CONTRACT
// PURPOSE: Organizer «Статистика» tab — the account analytics screen: period, income hero, four counters, income chart, per-event bars, promo and mailing tiles, and the create-event button.
// SCOPE: The presentational screen and the snapshot behind the period switch and the chart window. Figures follow the cabinet mock; creating an event is handed back to the organizer space.
// DEPENDS: react, ../ui/icons.js, ../ui/theme.css, ./OrganizerFinance.js (formatRub)
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT

import { useState } from "react";
import type { OrganizerEvent } from "../api/client";
import { formatStartsAt } from "../catalog/format";
import { SettingsGroup } from "../profile/SettingsPage";
import { ActionIcon } from "../ui/icons";
import { pictured } from "../ui/photos";
import { AppChip, AppMedia, AppState } from "../ui/primitives";
import { CABINET_EVENTS, cabinetAsOrganizerEvent, cabinetFillRows, cabinetStats, cabinetWeekdayBookings, defaultStatsRange, fillCaption, type CabinetFillRow } from "./cabinet-catalog";
import { useOrganizerNativeBack } from "./organizer-native-back";
import { OrganizerStats } from "./OrganizerStats";

const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"] as const;

function countLabel(value: number): string {
  return value.toLocaleString("ru-RU").replace(/\s/g, "\u00a0");
}

function weakFill(row: CabinetFillRow): boolean {
  return row.capacity > 0 && row.fill < 40;
}

function occupancyBars(values: number[]): Array<{ height: number; accent: boolean }> {
  const max = Math.max(...values, 0);
  const ranked = [...values].sort((a, b) => b - a);
  const accentFrom = ranked[1] ?? ranked[0] ?? 0;
  return values.map((value) => ({
    height: max === 0 ? 8 : Math.max(8, Math.round((value / max) * 100)),
    accent: value > 0 && value >= accentFrom,
  }));
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

function FillEventCard({ row, onOpen }: { row: CabinetFillRow; onOpen?: (event: OrganizerEvent) => void }) {
  const event = cabinetAsOrganizerEvent(CABINET_EVENTS.find((item) => item.id === row.id) ?? CABINET_EVENTS[0]);
  return (
    <button type="button" className="app-org-event" onClick={() => onOpen?.(event)}>
      <AppMedia category={row.category} src={pictured(row.id, event.coverUrl)} className="app-org-event-media" />
      <span className="app-org-event-body">
        <span className="app-org-event-title">{row.title}</span>
        <span className="app-org-event-meta">{formatStartsAt(row.startsAt)}</span>
        <span className="app-org-event-meta">{fillCaption(row.booked, row.capacity, row.fill)}</span>
        <span className="app-org-progress" aria-hidden="true">
          <span className="app-org-progress-fill" style={{ width: `${row.fill}%` }} />
        </span>
      </span>
      {weakFill(row) && <span className="app-org-event-badge">Продвинуть</span>}
    </button>
  );
}

export function OrganizerStatistics({ onOpenEvent, onCheckIn, onShowDrafts }: { onCreateEvent?: () => void; onOpenEvent?: (event: OrganizerEvent) => void; onCheckIn?: (event: OrganizerEvent) => void; onShowDrafts?: () => void }) {
  const initial = defaultStatsRange();
  const [days, setDays] = useState<StatsWindow>(30);
  const [to] = useState(initial.to);
  const from = new Date(new Date(`${to}T12:00:00+03:00`).getTime() - days * 86_400_000).toISOString().slice(0, 10);
  const [pane, setPane] = useState<"home" | "fill" | "sources" | "notices">("home");
  const snapshot = cabinetStats(CABINET_EVENTS, new Date(`${from}T00:00:00+03:00`), new Date(`${to}T23:59:59+03:00`));
  const fills = cabinetFillRows(CABINET_EVENTS, new Date(`${from}T00:00:00+03:00`), new Date(`${to}T23:59:59+03:00`));
  const weak = fills.filter(weakFill).slice(0, 4);
  const today = CABINET_EVENTS.find((item) => !item.draft && item.startsAt.slice(0, 10) === to);
  const drafts = CABINET_EVENTS.filter((item) => item.draft).length;
  useOrganizerNativeBack(pane !== "home", () => setPane("home"));

  const weekdays = cabinetWeekdayBookings(CABINET_EVENTS, new Date(`${from}T00:00:00+03:00`), new Date(`${to}T23:59:59+03:00`));
  const periods = (
    <div className="app-filters-chips" role="group" aria-label="Период">
      {STATS_WINDOWS.map((item) => (
        <AppChip key={item} pressed={days === item} onClick={() => setDays(item)}>
          {item} дней
        </AppChip>
      ))}
    </div>
  );

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

  if (pane === "sources") {
    return (
      <section className="app-gathering" aria-label="Источники регистраций">
        <h1 className="app-section-title">Источники регистраций</h1>
        <OrganizerStats embedded />
      </section>
    );
  }

  if (pane === "fill") {
    return (
      <section className="app-gathering" aria-label="Заполняемость">
        <h1 className="app-section-title">Заполняемость</h1>
        {periods}
        {fills.length === 0 ? (
          <AppState>За этот период опубликованных событий нет.</AppState>
        ) : (
          <div className="app-org-events">
            {fills.map((row) => (
              <FillEventCard key={row.id} row={row} onOpen={onOpenEvent} />
            ))}
          </div>
        )}
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
      {periods}
      <div className="app-org-tiles">
        <button type="button" className="app-org-tile" onClick={() => setPane("fill")}>
          <span className="app-org-tile-label">Регистрации</span>
          <span className="app-org-tile-big">{countLabel(snapshot.tickets)}</span>
        </button>
        <button type="button" className="app-org-tile" onClick={() => setPane("fill")}>
          <span className="app-org-tile-label">Заполняемость</span>
          <span className="app-org-tile-big">{snapshot.conversion}%</span>
        </button>
        <button type="button" className="app-org-tile" onClick={() => setPane("sources")}>
          <span className="app-org-tile-label">Источники</span>
          <span className="app-org-tile-big">3 канала</span>
        </button>
        <div className="app-org-tile">
          <span className="app-org-tile-label">События</span>
          <span className="app-org-tile-big">{snapshot.events}</span>
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
      <SettingsGroup title="Разбор">
        <button type="button" className="app-set-row" onClick={() => setPane("fill")}>
          <span className="app-set-row-text">
            <span className="app-set-row-title">Заполняемость</span>
          </span>
          <ActionIcon name="chevron" size={16} strokeWidth={2.6} />
        </button>
        <button type="button" className="app-set-row" onClick={() => setPane("sources")}>
          <span className="app-set-row-text">
            <span className="app-set-row-title">Источники регистраций</span>
          </span>
          <ActionIcon name="chevron" size={16} strokeWidth={2.6} />
        </button>
        {drafts > 0 && onShowDrafts !== undefined && (
          <button type="button" className="app-set-row" onClick={onShowDrafts}>
            <span className="app-set-row-text">
              <span className="app-set-row-title">Черновики</span>
            </span>
            <ActionIcon name="chevron" size={16} strokeWidth={2.6} />
          </button>
        )}
      </SettingsGroup>
      {fills.length > 0 && (
        <div className="app-org-events">
          {(weak.length > 0 ? weak : fills.slice(0, 3)).map((row) => (
            <FillEventCard key={row.id} row={row} onOpen={onOpenEvent} />
          ))}
        </div>
      )}
      {today !== undefined && onCheckIn !== undefined && (
        <button type="button" className="app-org-event" onClick={() => onCheckIn(cabinetAsOrganizerEvent(today))}>
          <AppMedia category={today.category} src={pictured(today.id, null)} className="app-org-event-media" />
          <span className="app-org-event-body">
            <span className="app-org-event-title">{today.title}</span>
            <span className="app-org-event-meta">Сегодня</span>
            <span className="app-org-event-meta">Контроль входа</span>
          </span>
        </button>
      )}
    </section>
  );
}
