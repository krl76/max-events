// START_MODULE_CONTRACT
// PURPOSE: Pure wording and arithmetic of the slot screens (макет, экраны 34, 19, 20, 21): windows, durations, money, the forecast glyph, the date strip, the bill split between the company and the placeholder code block.
// SCOPE: Formatting and arithmetic only — no fetching, no state, no JSX. Everything here is what the screens are asserted through, since ionic hides component markup from the server renderer.
// DEPENDS: ../api/client.js (PlaceSlot, SlotExtra), ../catalog/format.js (pluralRu), ../ui/icons.js (ActionIconName), @max-events/api-contracts (EventWeather, Friend)
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - formatTime - «17:30» Moscow time of an ISO stamp
// - formatSlotWindow - «17:30 – 20:30» of one window
// - slotMinutes - length of a window in minutes
// - formatSlotDuration - «3 часа» / «2,5 часа» of a window
// - formatRub - «2 400 ₽», the money wording every slot screen prints
// - formatTemperature - «+22°» / «−4°»
// - weatherIcon - forecast -> the glyph of the design: clear sun, cloud, rain
// - slotDayCell - date -> the two lines of a strip cell («ЧТ» / «18»)
// - formatSlotDayTitle - «пятница, 19 сентября» above the windows
// - formatBookingDate - «Пт, 19 сентября» of a booking card
// - slotStatusLabel - «Свободно» / «Занято» and the «занято до 13:30» line under it
// - companyLabel - «Ты, Анна и Дима» — the viewer first, then the company
// - SlotBillRow - one line of the bill: what it is and what it costs
// - SlotBill - the bill of a booking: rows, total and the share of one person
// - slotBill - window + chosen add-ons + party size -> the bill экран 19 prints
// - CodeCell - one cell of the code block: off, on or the accent of the design
// - codeMatrix - entry code -> a stable square of cells (the placeholder of the scannable code)
// END_MODULE_MAP

import type { EventWeather, Friend } from "@max-events/api-contracts";
import type { PlaceSlot, SlotExtra } from "../api/client";
import { pluralRu } from "../catalog/format";
import type { ActionIconName } from "../ui/icons";

const MSK = "Europe/Moscow";

export function formatTime(at: string): string {
  return new Date(at).toLocaleTimeString("ru-RU", { timeZone: MSK, hour: "2-digit", minute: "2-digit" });
}

/** The en dash with spaces is the design's own separator; a hyphen reads as a range of numbers. */
export function formatSlotWindow(slot: Pick<PlaceSlot, "startsAt" | "endsAt">): string {
  return `${formatTime(slot.startsAt)} – ${formatTime(slot.endsAt)}`;
}

export function slotMinutes(slot: Pick<PlaceSlot, "startsAt" | "endsAt">): number {
  return Math.round((new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime()) / 60000);
}

/** «3 часа» for a whole number of hours, «2,5 часа» for anything else — the two forms of the design. */
export function formatSlotDuration(slot: Pick<PlaceSlot, "startsAt" | "endsAt">): string {
  const minutes = slotMinutes(slot);
  const hours = minutes / 60;
  if (Number.isInteger(hours)) return `${hours} ${pluralRu(hours, "час", "часа", "часов")}`;
  return `${hours.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} часа`;
}

export function formatRub(value: number): string {
  return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

export function formatTemperature(celsius: number): string {
  const rounded = Math.round(celsius);
  return `${rounded > 0 ? "+" : ""}${rounded}°`;
}

/**
 * WMO codes the forecast carries: 0 is a clear sky, everything up to the drizzles is a cloud, and
 * from 51 on it is falling on you. Three glyphs, exactly as the strip of экран 19 draws them.
 */
export function weatherIcon(weather: EventWeather): ActionIconName {
  if (weather.conditionCode === 0) return "sun";
  return weather.conditionCode < 51 ? "weather" : "rain";
}

/** «ЧТ» and «18» — the two lines of one date cell; the weekday is upper-cased the way the design sets it. */
export function slotDayCell(date: string): { weekday: string; day: string } {
  const at = new Date(`${date}T12:00:00+03:00`);
  return { weekday: at.toLocaleDateString("ru-RU", { timeZone: MSK, weekday: "short" }).toUpperCase(), day: at.toLocaleDateString("ru-RU", { timeZone: MSK, day: "numeric" }) };
}

export function formatSlotDayTitle(date: string): string {
  return new Date(`${date}T12:00:00+03:00`).toLocaleDateString("ru-RU", { timeZone: MSK, weekday: "long", day: "numeric", month: "long" });
}

/** «Пт, 19 сентября» — the short weekday of a booking card, capitalised like the design. */
export function formatBookingDate(at: string): string {
  const date = new Date(at);
  const weekday = date.toLocaleDateString("ru-RU", { timeZone: MSK, weekday: "short" });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${date.toLocaleDateString("ru-RU", { timeZone: MSK, day: "numeric", month: "long" })}`;
}

/** The pill on the right of a window row, and the line that replaces its price when it is taken. */
export function slotStatusLabel(slot: Pick<PlaceSlot, "status" | "busyUntil">): { label: string; free: boolean; hint: string | null } {
  if (slot.status === "free") return { label: "Свободно", free: true, hint: null };
  const hint = slot.busyUntil === null ? null : `занято до ${formatTime(slot.busyUntil)}`;
  return { label: slot.status === "held" ? "Держим" : "Занято", free: false, hint };
}

/** «Ты, Анна и Дима»: the viewer always opens the line, so a company of one still reads as a sentence. */
export function companyLabel(company: Friend[]): string {
  const names = ["Ты", ...company.map((friend) => friend.name.split(" ")[0])];
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} и ${names[names.length - 1]}`;
}

export interface SlotBillRow {
  label: string;
  amountRub: number;
}

export interface SlotBill {
  rows: SlotBillRow[];
  totalRub: number;
  /** The share of one person, rounded up so the sum of the shares always covers the bill. */
  perPersonRub: number;
  partySize: number;
}

/**
 * The bill of экран 19. The per-person share is rounded up on purpose: rounding down leaves the
 * venue short by a rouble or two, and the screen promises «счёт делится на 3», not «примерно».
 */
export function slotBill(slot: Pick<PlaceSlot, "startsAt" | "endsAt" | "priceRub">, extras: SlotExtra[], partySize: number): SlotBill {
  const rows: SlotBillRow[] = [{ label: `Слот ${formatSlotWindow(slot)}`, amountRub: slot.priceRub ?? 0 }];
  for (const extra of extras) rows.push({ label: extra.title, amountRub: extra.priceRub });
  const totalRub = rows.reduce((sum, row) => sum + row.amountRub, 0);
  const size = Math.max(1, partySize);
  return { rows, totalRub, perPersonRub: Math.ceil(totalRub / size), partySize: size };
}

export type CodeCell = "off" | "on" | "accent";

/**
 * The block above the entry code stands in for the scannable code itself: MAX gives a mini-app no
 * scanner and the backend issues no code at all (#492), so drawing a real symbology would be a lie.
 * It is derived from the code, which makes it stable per booking — the same booking always looks
 * the same — and it carries no information, so it is aria-hidden wherever it is used.
 */
export function codeMatrix(code: string, size = 7): CodeCell[] {
  let seed = 7;
  for (const char of code) seed = (seed * 31 + char.charCodeAt(0)) % 100003;
  const cells: CodeCell[] = [];
  for (let index = 0; index < size * size; index += 1) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const value = Math.floor(seed / 65536);
    cells.push(value % 5 === 0 ? "off" : value % 23 === 0 ? "accent" : value % 3 === 0 ? "off" : "on");
  }
  return cells;
}
