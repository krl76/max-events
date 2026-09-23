// START_MODULE_CONTRACT
// PURPOSE: Shared Europe/Moscow calendar date and clock time for user-facing buckets and bot messages.
// SCOPE: moscowDateKey(date) → YYYY-MM-DD in Moscow; moscowTimeLabel(date) → HH:MM in Moscow; used instead of a UTC slice or a raw ISO string.
// DEPENDS: none
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - moscowDateKey - YYYY-MM-DD in Europe/Moscow
// - moscowTimeLabel - HH:MM in Europe/Moscow, for text a person reads
// END_MODULE_MAP

export function moscowDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function moscowTimeLabel(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("hour")}:${value("minute")}`;
}
