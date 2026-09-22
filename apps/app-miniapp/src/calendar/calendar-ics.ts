// START_MODULE_CONTRACT
// PURPOSE: Build an ICS calendar from the viewer's bookings for export (#484).
// SCOPE: Pure string builder; DTSTART/DTEND from event startsAt; UID from booking id.
// DEPENDS: ../api/client.js (CalendarEntry)
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - icsStamp - UTC YYYYMMDDTHHMMSSZ
// - buildCalendarIcs - VCALENDAR of booked events
// END_MODULE_MAP

import type { CalendarEntry } from "../api/client";

export function icsStamp(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

const DEFAULT_DURATION_MS = 60 * 60 * 1000;

export function buildCalendarIcs(entries: CalendarEntry[]): string {
  const events = entries
    .map((entry) => {
      const startMs = Date.parse(entry.event.startsAt);
      const start = icsStamp(entry.event.startsAt);
      const endMs = entry.event.endsAt !== null && Date.parse(entry.event.endsAt) > startMs ? Date.parse(entry.event.endsAt) : startMs + DEFAULT_DURATION_MS;
      const end = icsStamp(new Date(endMs).toISOString());
      const summary = entry.event.title.replace(/[,\\;]/g, " ");
      return ["BEGIN:VEVENT", `UID:${entry.booking.id}@max-events`, `DTSTAMP:${start}`, `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${summary}`, "END:VEVENT"].join("\r\n");
    })
    .join("\r\n");
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MAX Events//RU", events, "END:VCALENDAR"].join("\r\n");
}
