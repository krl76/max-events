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

export function buildCalendarIcs(entries: CalendarEntry[]): string {
  const events = entries
    .map((entry) => {
      const start = icsStamp(entry.event.startsAt);
      const endSource = entry.event.endsAt ?? entry.event.startsAt;
      const end = icsStamp(endSource);
      const summary = entry.event.title.replace(/[,\\;]/g, " ");
      return ["BEGIN:VEVENT", `UID:${entry.booking.id}@max-events`, `DTSTAMP:${start}`, `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${summary}`, "END:VEVENT"].join("\r\n");
    })
    .join("\r\n");
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MAX Events//RU", events, "END:VCALENDAR"].join("\r\n");
}
