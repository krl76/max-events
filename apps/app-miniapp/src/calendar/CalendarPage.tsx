// START_MODULE_CONTRACT
// PURPOSE: Calendar screen: own bookings split into upcoming/past sections, booking cards, cancel action, and the micro-events the viewer joined.
// SCOPE: Data via apiClient.listCalendar (mock or live), cancel via apiClient.cancelBooking; sectioning by the event start date. Micro-events are not bookings and never reach GET /calendar, so they come as their own block from MyMicroEventsSection.
// DEPENDS: ../api/client.js (apiClient, CalendarEntry), ../auth/AuthContext.js, ../micro/MicroEvents.js (MyMicroEventsSection), ../catalog/CatalogPage.js (CATEGORY_LABELS, formatStartsAt), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CalendarState - union of calendar fetch states (loading / error / ready)
// - splitCalendarEntries - split entries into upcoming (>= now, soonest first) and past (< now, latest first)
// - CalendarView - presentational: two sections with booking cards and empty states
// - CalendarPage - container (the calendar tab of the «Моё» screen): resolves the user id, loads the calendar, wires cancel + refetch, and renders the joined micro-events under it
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import { apiClient, type CalendarEntry } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { CATEGORY_LABELS, formatStartsAt } from "../catalog/CatalogPage";
import { MyMicroEventsSection } from "../micro/MicroEvents";
import { useRoute } from "../routing/router";
import { AppButton, AppState, AppSection, AppMedia } from "../ui/primitives";

export type CalendarState = { status: "loading" } | { status: "error" } | { status: "ready"; entries: CalendarEntry[] };

export function splitCalendarEntries(entries: CalendarEntry[], now: Date): { upcoming: CalendarEntry[]; past: CalendarEntry[] } {
  const byStartAsc = (a: CalendarEntry, b: CalendarEntry) => a.event.startsAt.localeCompare(b.event.startsAt);
  return {
    upcoming: entries.filter((entry) => new Date(entry.event.startsAt).getTime() >= now.getTime()).sort(byStartAsc),
    past: entries.filter((entry) => new Date(entry.event.startsAt).getTime() < now.getTime()).sort((a, b) => -byStartAsc(a, b)),
  };
}

function BookingCard({ entry, onCancel }: { entry: CalendarEntry; onCancel: (() => void) | null }) {
  const { event, place } = entry;
  return (
    <article className="app-card app-card--row">
      <AppMedia category={event.category} />
      <div className="app-card-body">
        <span className="app-card-title">{event.title}</span>
        <span className="app-card-subtitle">
          {formatStartsAt(event.startsAt)} · {place === null ? event.city : place.title}
        </span>
        <span className="app-card-subtitle">
          {CATEGORY_LABELS[event.category]} · {event.priceRub === null ? "Бесплатно" : `${event.priceRub} ₽`}
        </span>
        {onCancel !== null && (
          <AppButton className="app-calendar-cancel" size="small" tone="danger" onClick={onCancel}>
            Отменить запись
          </AppButton>
        )}
      </div>
    </article>
  );
}

interface CalendarViewProps {
  state: CalendarState;
  now: Date;
  onCancel: (bookingId: string) => void;
  onExplore: () => void;
}

export function CalendarView({ state, now, onCancel, onExplore }: CalendarViewProps) {
  if (state.status === "loading") return <AppState>Загрузка…</AppState>;
  if (state.status === "error") return <AppState error>Не удалось загрузить календарь.</AppState>;

  const { upcoming, past } = splitCalendarEntries(state.entries, now);
  return (
    <>
      <AppSection title="Запланированные" className="app-cards-flat">
        {upcoming.length === 0 ? <AppState action={{ label: "Найти событие", onClick: onExplore }}>Нет запланированных событий.</AppState> : upcoming.map((entry) => <BookingCard key={entry.booking.id} entry={entry} onCancel={() => onCancel(entry.booking.id)} />)}
      </AppSection>
      <AppSection title="Прошедшие" className="app-cards-flat">
        {past.length === 0 ? <AppState>Нет прошедших событий.</AppState> : past.map((entry) => <BookingCard key={entry.booking.id} entry={entry} onCancel={null} />)}
      </AppSection>
    </>
  );
}

export function CalendarPage() {
  const auth = useAuth();
  const { navigate } = useRoute();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const [state, setState] = useState<CalendarState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (userId === null) return;
    let alive = true;
    setState({ status: "loading" });
    apiClient.listCalendar().then(
      (entries) => {
        if (alive) setState({ status: "ready", entries });
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [userId, attempt]);

  const cancel = useCallback((bookingId: string) => {
    apiClient.cancelBooking(bookingId).then(
      () => setAttempt((n) => n + 1),
      () => setAttempt((n) => n + 1),
    );
  }, []);

  return (
    <>
      <CalendarView state={state} now={new Date()} onCancel={cancel} onExplore={() => navigate({ name: "home" })} />
      {/* Below the bookings: a micro-event the viewer joined is a record of their own too, and it used to live nowhere but the feed. */}
      <MyMicroEventsSection />
    </>
  );
}
