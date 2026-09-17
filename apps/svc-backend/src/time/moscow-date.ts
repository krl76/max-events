// START_MODULE_CONTRACT
// PURPOSE: Shared Europe/Moscow calendar date for nearby and place-page «today» buckets.
// SCOPE: moscowDateKey(date) → YYYY-MM-DD in Moscow; used instead of UTC slice for user-facing "today".
// DEPENDS: none
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - moscowDateKey - YYYY-MM-DD in Europe/Moscow
// END_MODULE_MAP

export function moscowDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}`;
}
