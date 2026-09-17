// START_MODULE_CONTRACT
// PURPOSE: Recurring plan occurrence math in Europe/Moscow — weekly weekday and nth weekday of month.
// SCOPE: nextRecurringAt / upcomingRecurringAts; ISO weekday 1=Mon..7=Sun.
// DEPENDS: @max-events/api-contracts
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - moscowIsoWeekday - ISO weekday in Europe/Moscow
// - nextRecurringAt - next occurrence strictly after a timestamp
// - upcomingRecurringAts - next N occurrences
// END_MODULE_MAP

import type { PlanRecurringRule } from "@max-events/api-contracts";

const WEEKDAY_ISO: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
const DAY_MS = 86_400_000;

export function moscowIsoWeekday(date: Date): number {
  const label = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Moscow", weekday: "short" }).format(date);
  const weekday = WEEKDAY_ISO[label];
  if (!weekday) throw new Error(`Unknown weekday label: ${label}`);
  return weekday;
}

export function nextRecurringAt(from: Date, rule: PlanRecurringRule, after: Date): Date {
  if (rule.type === "weekly_weekday") return nextWeeklyFromAfter(from, rule.weekday, after);
  return nextMonthlyFromAfter(from, rule.nth, rule.weekday, after);
}

export function upcomingRecurringAts(from: Date, rule: PlanRecurringRule, after: Date, count: number): Date[] {
  const out: Date[] = [];
  let cursor = after;
  for (let i = 0; i < count; i += 1) {
    cursor = nextRecurringAt(from, rule, cursor);
    out.push(cursor);
  }
  return out;
}

function nextWeeklyFromAfter(from: Date, weekday: number, after: Date): Date {
  let day = new Date(after.getTime());
  for (let i = 0; i < 14; i += 1) {
    const ymd = moscowYmd(day);
    const stamp = moscowStamp(ymd.y, ymd.m, ymd.d, from);
    if (moscowIsoWeekday(stamp) === weekday && stamp.getTime() > after.getTime()) return stamp;
    day = new Date(day.getTime() + DAY_MS);
  }
  throw new Error("Could not compute next weekly occurrence");
}

function nextMonthlyFromAfter(from: Date, nth: number, weekday: number, after: Date): Date {
  const start = moscowYmd(after);
  let year = start.y;
  let month = start.m;
  for (let i = 0; i < 24; i += 1) {
    const candidate = nthWeekdayInMonth(year, month, nth, weekday, from);
    if (candidate && candidate.getTime() > after.getTime()) return candidate;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  throw new Error("Could not compute next monthly occurrence");
}

function nthWeekdayInMonth(year: number, month: number, nth: number, weekday: number, template: Date): Date | null {
  const hits: Date[] = [];
  for (let day = 1; day <= 31; day += 1) {
    const stamp = moscowStamp(year, month, day, template);
    if (stamp.getUTCMonth() + 1 !== month && moscowYmd(stamp).m !== month) continue;
    if (moscowYmd(stamp).m !== month || moscowYmd(stamp).y !== year) continue;
    if (moscowIsoWeekday(stamp) === weekday) hits.push(stamp);
  }
  if (nth === 5) return hits[hits.length - 1] ?? null;
  return hits[nth - 1] ?? null;
}

function moscowYmd(date: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const num = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { y: num("year"), m: num("month"), d: num("day") };
}

function moscowStamp(year: number, month: number, day: number, template: Date): Date {
  const tpl = moscowHms(template);
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(tpl.h).padStart(2, "0")}:${String(tpl.min).padStart(2, "0")}:${String(tpl.s).padStart(2, "0")}+03:00`;
  return new Date(iso);
}

function moscowHms(date: Date): { h: number; min: number; s: number } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, hourCycle: "h23" }).formatToParts(date);
  const num = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { h: num("hour"), min: num("minute"), s: num("second") };
}
