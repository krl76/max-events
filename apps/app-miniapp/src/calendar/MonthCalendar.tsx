// START_MODULE_CONTRACT
// PURPOSE: Сетка месяца и разбор записей для экрана 22 «Календарь планов»: свои брони и планы вместе с записями друга, точки под числами, напоминание о ближайшем и предупреждение о накладке.
// SCOPE: Чистые функции над CalendarEntry / PlanCard / SharedCalendar плюс презентационная сетка; ничего не грузит — данные приносит ./CalendarPage.tsx.
// DEPENDS: ../api/client.js (CalendarEntry, SharedCalendar), @max-events/api-contracts (PlanCard), ../catalog/format.js (pluralRu), ../ui/theme.css
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - WEEKDAY_LABELS - шапка сетки, неделя с понедельника
// - CalendarSource - чья запись: своя или друга, с которым открыт общий календарь
// - CalendarDayEntry - одна запись общего календаря, уже сведённая к тому, что рисует строка
// - dayKey - «2026-09-18» по локальному календарю (сравнение дней, а не мгновений)
// - monthGridDays - дни сетки месяца: полные недели с понедельника, с хвостами соседних месяцев
// - monthTitle - «Сентябрь 2026» над сеткой
// - dayTitle - «8 сентября · вторник» над списком дня
// - entryTime - «19:00» рядом с названием записи
// - mergeCalendarEntries - брони, планы и записи друга -> строки календаря; «оба идёте» сводит две записи в одну
// - entriesOn - записи выбранного дня, по времени
// - entryEndMs - конец записи: явный, а без него — два часа от начала
// - overlapWarnings - накладки дня: пары записей, которые идут внахлёст
// - calendarReminder - напоминание о ближайшей записи в пределах суток
// - MonthGrid - презентационно: шапка недели и числа месяца с точками источников
// END_MODULE_MAP

import type { PlanCard } from "@max-events/api-contracts";
import type { CalendarEntry, SharedCalendar } from "../api/client";
import { pluralRu } from "../catalog/format";

export const WEEKDAY_LABELS: readonly string[] = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

export type CalendarSource = "own" | "peer";

/** Одна строка дня: уже сведённая запись, из какого бы источника она ни пришла. */
export interface CalendarDayEntry {
  id: string;
  /** Обе метки сразу — это «оба идёте»: под числом тогда стоят две точки. */
  sources: CalendarSource[];
  title: string;
  startsAt: string;
  endsAt: string | null;
  note: string;
  /** Запись друга, на которую зритель не ответил: строка предлагает «Пойду». */
  needsResponse: boolean;
  /** Инициалы для стопки лиц справа. */
  faces: string[];
  eventId: string | null;
  /** Заполнен у своей записи, пришедшей из плана: строка ведёт на экран плана. */
  planId: string | null;
  /** Заполнен у записи друга: по нему уходит «Пойду». */
  sharedId: string | null;
}

export function dayKey(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Полные недели с понедельника: сетка не прыгает по высоте от месяца к месяцу, и хвосты видны серым. */
export function monthGridDays(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - lead);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const total = lead + last.getDate();
  const cells = Math.ceil(total / 7) * 7;
  return Array.from({ length: cells }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
}

/** Месяц и год собираются порознь: вместе ru-локаль добавляет «г.», которого в макете нет. */
export function monthTitle(month: Date): string {
  const label = month.toLocaleDateString("ru-RU", { month: "long" });
  return `${label.charAt(0).toUpperCase()}${label.slice(1)} ${month.getFullYear()}`;
}

export function dayTitle(day: Date): string {
  return `${day.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} · ${day.toLocaleDateString("ru-RU", { weekday: "long" })}`;
}

export function entryTime(startsAt: string): string {
  return new Date(startsAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Сводит три источника в одни строки. Когда друг отметил то же событие, на которое зритель уже записан,
 * это одна строка с двумя лицами — «оба идёте», а не две записи об одном вечере.
 *
 * Подписи об авторе записи пола не называют: его нет ни в контракте Friend, ни на бэкенде, а «добавила»
 * из макета верно ровно для половины имён. Строка говорит имя и состояние — и ничего не выдумывает.
 */
export function mergeCalendarEntries(bookings: CalendarEntry[], plans: PlanCard[], shared: SharedCalendar | null): CalendarDayEntry[] {
  const sharedEntries = shared?.entries ?? [];
  const bothGoingEventIds = new Set(sharedEntries.filter((entry) => entry.bothGoing && entry.eventId !== null).map((entry) => entry.eventId as string));
  const rows: CalendarDayEntry[] = [];
  for (const { booking, event, place } of bookings) {
    if (bothGoingEventIds.has(event.id)) continue;
    rows.push({ id: `booking-${booking.id}`, sources: ["own"], title: event.title, startsAt: event.startsAt, endsAt: event.endsAt, note: place === null ? "ваша бронь" : `ваша бронь · ${place.title}`, needsResponse: false, faces: ["Я"], eventId: event.id, planId: null, sharedId: null });
  }
  for (const { plan, event } of plans) {
    if (bothGoingEventIds.has(event.id)) continue;
    rows.push({
      id: `plan-${plan.id}`,
      sources: ["own"],
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      note: `ваш план · сбор ${entryTime(plan.meetingAt)}`,
      needsResponse: false,
      faces: ["Я", ...plan.participants.map((row) => row.friend.name.charAt(0))],
      eventId: event.id,
      planId: plan.id,
      sharedId: null,
    });
  }
  for (const entry of sharedEntries) {
    rows.push({
      id: `shared-${entry.id}`,
      sources: entry.bothGoing ? ["own", "peer"] : ["peer"],
      title: entry.title,
      startsAt: entry.startsAt,
      endsAt: entry.endsAt,
      note: entry.bothGoing ? "оба идёте" : `${entry.owner.name.split(" ")[0]} · вы не отметились`,
      needsResponse: entry.needsResponse,
      faces: entry.bothGoing ? ["Я", entry.owner.name.charAt(0)] : [entry.owner.name.charAt(0)],
      eventId: entry.eventId,
      planId: null,
      sharedId: entry.id,
    });
  }
  return rows.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function entriesOn(entries: CalendarDayEntry[], day: Date): CalendarDayEntry[] {
  const key = dayKey(day);
  return entries.filter((entry) => dayKey(entry.startsAt) === key);
}

/** Запись без явного конца всё равно занимает вечер: два часа — то, во что укладывается большинство событий. */
const DEFAULT_ENTRY_MINUTES = 120;

export function entryEndMs(entry: Pick<CalendarDayEntry, "startsAt" | "endsAt">): number {
  return entry.endsAt === null ? Date.parse(entry.startsAt) + DEFAULT_ENTRY_MINUTES * 60_000 : Date.parse(entry.endsAt);
}

/** Накладки дня: всё, что начинается раньше, чем кончается предыдущее. Каждая пара называется один раз. */
export function overlapWarnings(entries: CalendarDayEntry[]): string[] {
  const sorted = [...entries].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const warnings: string[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      if (Date.parse(sorted[j].startsAt) < entryEndMs(sorted[i])) warnings.push(`«${sorted[i].title}» и «${sorted[j].title}» идут внахлёст`);
    }
  }
  return warnings;
}

const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Напоминание о ближайшем: в пределах суток — иначе это не напоминание, а просто следующая запись. */
export function calendarReminder(entries: CalendarDayEntry[], now: Date): string | null {
  const soon = entries
    .filter((entry) => {
      const delta = Date.parse(entry.startsAt) - now.getTime();
      return delta >= 0 && delta <= REMINDER_WINDOW_MS;
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  if (soon === undefined) return null;
  const hours = Math.round((Date.parse(soon.startsAt) - now.getTime()) / 3_600_000);
  if (hours <= 1) return `Скоро: «${soon.title}» в ${entryTime(soon.startsAt)}`;
  return `Через ${hours} ${pluralRu(hours, "час", "часа", "часов")}: «${soon.title}» в ${entryTime(soon.startsAt)}`;
}

interface MonthGridProps {
  month: Date;
  selected: Date;
  entries: CalendarDayEntry[];
  onSelect: (day: Date) => void;
}

export function MonthGrid({ month, selected, entries, onSelect }: MonthGridProps) {
  const selectedKey = dayKey(selected);
  const byDay = new Map<string, Set<CalendarSource>>();
  for (const entry of entries) {
    const key = dayKey(entry.startsAt);
    const marks = byDay.get(key) ?? new Set<CalendarSource>();
    for (const source of entry.sources) marks.add(source);
    byDay.set(key, marks);
  }
  return (
    <>
      <div className="app-cal-weekdays" aria-hidden="true">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="app-cal-grid" role="group" aria-label={monthTitle(month)}>
        {monthGridDays(month).map((day) => {
          const key = dayKey(day);
          const marks = byDay.get(key);
          const outside = day.getMonth() !== month.getMonth();
          const classes = ["app-cal-day", outside ? "app-cal-day--outside" : "", marks === undefined ? "" : "app-cal-day--busy", marks?.has("peer") === true && marks.has("own") === false ? "app-cal-day--peer" : "", key === selectedKey ? "app-cal-day--on" : ""].filter(Boolean).join(" ");
          return (
            <button key={key} type="button" className={classes} aria-pressed={key === selectedKey} aria-label={dayTitle(day)} onClick={() => onSelect(day)}>
              <span className="app-cal-day-num">{day.getDate()}</span>
              {marks !== undefined && (
                <span className="app-cal-day-dots" aria-hidden="true">
                  {marks.has("own") && <span className="app-cal-dot app-cal-dot--own" />}
                  {marks.has("peer") && <span className="app-cal-dot app-cal-dot--peer" />}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
