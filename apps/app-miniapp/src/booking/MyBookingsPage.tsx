// START_MODULE_CONTRACT
// PURPOSE: Экран 21 «Мои брони»: the three kinds of a booking in one list but apart — venue windows with their entry code, event tickets, waiting positions — plus the past ones with «Оценить» and «Повторить».
// SCOPE: Reads apiClient.listMySlots (the slot domain), apiClient.listCalendar (event bookings, the existing surface) and apiClient.listCheckInCodes (the codes, #492); writes apiClient.leaveSlotWaitlist. Filtering and the search are local to the loaded cards — there is no booking search endpoint.
// DEPENDS: ../api/client.js (apiClient, CalendarEntry, MySlotsBoard, CheckInCode), ../auth/AuthContext.js, ../catalog/format.js (pluralRu), ../max/bridge.js (shareResult, webApp), ../place/slots.js, ./BookingTicketPage.js (CodeBlock), ../routing/router.js, ../ui/icons.js, ../ui/primitives.js, @max-events/api-contracts (EventCategory), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - BOOKING_TABS - the four filters of the design in order: активные / билеты / слоты / прошедшие
// - BookingTab - one filter of the list
// - BookingCard - one active card of any of the three kinds, already worded for the screen
// - PastBookingCard - one past booking: what it was, when, and what can be done about it now
// - BookingsBoard - the whole screen: active cards, past cards and the two counters of the header
// - bookingCards - slot board + calendar + codes -> the board of the screen, newest first
// - filterBookingCards - the tab and the search needle applied to the active cards
// - BookingsState - union of the fetch states (loading / error / ready)
// - MyBookingsView - presentational: topbar, segments, filters, the grouped cards and the past list
// - MyBookingsPage - route container: loads the three sources, filters locally, leaves a waitlist, opens a ticket
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import type { EventCategory } from "@max-events/api-contracts";
import { apiClient, whenEndpointMissing, type CalendarEntry, type CheckInCode, type MySlotsBoard } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { pluralRu } from "../catalog/format";
import { shareResult, webApp } from "../max/bridge";
import { companyLabel, formatBookingDate, formatRub, formatSlotWindow, formatTime } from "../place/slots";
import { CodeBlock } from "./BookingTicketPage";
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { AppMedia, AppSkeletonList, AppState } from "../ui/primitives";

export const BOOKING_TABS = [
  { id: "active", label: "Активные" },
  { id: "tickets", label: "Билеты" },
  { id: "slots", label: "Слоты" },
  { id: "past", label: "Прошедшие" },
] as const;

export type BookingTab = (typeof BOOKING_TABS)[number]["id"];

/** One active card. The three kinds share a shape because the design draws them the same and only marks them apart. */
export interface BookingCard {
  kind: "slot" | "ticket" | "waitlist";
  /** Id of the booking, the ticket or the waiting position — what the actions of the card act on. */
  id: string;
  /** «Серебряный Бор, беседка №4» — the line over the card. */
  venue: string;
  title: string;
  /** «Пт, 19 сентября · 17:30 – 20:30 · 3 000 ₽» over the gradient. */
  meta: string;
  /** The pill in the corner: what this card is. */
  badge: string;
  /** Category of the event behind the card; null for a venue window, which has no category. */
  category: EventCategory | null;
  /** Initials of the company, the viewer first. */
  faces: string[];
  /** «Ты, Анна и Дима» / «Ждём 2 места». */
  company: string;
  /** Entry code, when the booking has one. */
  code: string | null;
  /** The event behind a ticket; null for a venue window, which has no event. */
  eventId: string | null;
  /** The venue behind a window or a waiting position; null for a ticket without a place. */
  placeId: string | null;
  startsAt: string;
}

export interface PastBookingCard {
  /** Id of the event: the past list is about events, and «Оценить» opens экран 35 by it. */
  eventId: string;
  title: string;
  /** «Чт, 11 сентября». */
  meta: string;
  category: EventCategory;
}

export interface BookingsBoard {
  active: BookingCard[];
  past: PastBookingCard[];
  activeCount: number;
  pastCount: number;
}

/**
 * The three sources of the screen folded into its cards. The event tickets come from the calendar —
 * the surface that already answers «what have I booked» — and the codes from the slot domain, because
 * no booking carries one (#492). A card is «past» by its start, the same rule the calendar uses.
 */
export function bookingCards(slots: MySlotsBoard, calendar: CalendarEntry[], codes: CheckInCode[], now: Date): BookingsBoard {
  const codeOf = new Map(codes.map((code) => [code.bookingId, code.code]));
  const active: BookingCard[] = [];
  const past: PastBookingCard[] = [];
  for (const card of slots.bookings) {
    active.push({
      kind: "slot",
      id: card.booking.id,
      venue: `${card.place.title}, ${card.unitTitle.toLowerCase()}`,
      title: card.activity,
      meta: `${formatBookingDate(card.slot.startsAt)} · ${formatSlotWindow(card.slot)} · ${formatRub(card.booking.totalRub)}`,
      badge: "Слот забронирован",
      category: null,
      faces: ["Я", ...card.company.map((friend) => friend.name.charAt(0))],
      company: companyLabel(card.company),
      code: card.booking.checkInCode,
      eventId: null,
      placeId: card.place.id,
      startsAt: card.slot.startsAt,
    });
  }
  for (const card of slots.waitlist) {
    active.push({
      kind: "waitlist",
      id: card.entry.id,
      venue: `${card.place.title}, ${card.unitTitle.toLowerCase()}`,
      title: card.activity,
      meta: `${formatBookingDate(card.slot.startsAt)} · ${formatSlotWindow(card.slot)}${card.slot.priceRub === null ? "" : ` · ${formatRub(card.slot.priceRub)}`}`,
      badge: `Лист ожидания · ${card.entry.position}-й`,
      category: null,
      faces: ["Я"],
      company: `Ждём ${card.entry.seats} ${pluralRu(card.entry.seats, "место", "места", "мест")}`,
      code: null,
      eventId: null,
      placeId: card.place.id,
      startsAt: card.slot.startsAt,
    });
  }
  for (const entry of calendar) {
    const startsAt = entry.event.startsAt;
    if (new Date(startsAt).getTime() < now.getTime()) {
      past.push({ eventId: entry.event.id, title: entry.event.title, meta: formatBookingDate(startsAt), category: entry.event.category });
      continue;
    }
    const price = entry.event.isPaid && entry.event.priceRub !== null ? ` · ${formatRub(entry.event.priceRub)}` : " · бесплатно";
    active.push({
      kind: "ticket",
      id: entry.booking.id,
      venue: entry.place?.title ?? "Билеты у организатора",
      title: entry.event.title,
      meta: `${formatBookingDate(startsAt)} · ${formatTime(startsAt)} · 1 билет${price}`,
      badge: "Билеты у организатора",
      category: entry.event.category,
      faces: ["Я"],
      company: companyLabel([]),
      code: codeOf.get(entry.booking.id) ?? null,
      eventId: entry.event.id,
      placeId: entry.place?.id ?? null,
      startsAt,
    });
  }
  active.sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  past.sort((left, right) => right.meta.localeCompare(left.meta));
  return { active, past, activeCount: active.length, pastCount: past.length };
}

/** The tab narrows the kinds, the needle matches what is written on the card — nothing here asks the backend. */
export function filterBookingCards(cards: BookingCard[], tab: BookingTab, query: string): BookingCard[] {
  const needle = query.trim().toLowerCase();
  return cards.filter((card) => {
    if (tab === "tickets" && card.kind !== "ticket") return false;
    if (tab === "slots" && card.kind === "ticket") return false;
    if (needle === "") return true;
    return `${card.title} ${card.venue}`.toLowerCase().includes(needle);
  });
}

export type BookingsState = { status: "loading" } | { status: "error" } | { status: "ready"; board: BookingsBoard };

interface MyBookingsViewProps {
  board: BookingsBoard;
  tab: BookingTab;
  query: string;
  searching: boolean;
  menuId: string | null;
  onTab: (tab: BookingTab) => void;
  onQuery: (query: string) => void;
  onToggleSearch: () => void;
  onCalendar: () => void;
  onOpenTicket: (card: BookingCard) => void;
  onLeaveWaitlist: (entryId: string) => void;
  onMenu: (id: string | null) => void;
  onShare: (card: BookingCard) => void;
  onRate: (eventId: string) => void;
  onRepeat: (eventId: string) => void;
}

function BookingCardView({ card, menuOpen, onOpenTicket, onLeaveWaitlist, onMenu, onShare }: { card: BookingCard; menuOpen: boolean; onOpenTicket: () => void; onLeaveWaitlist: () => void; onMenu: () => void; onShare: () => void }) {
  return (
    <section className="app-book-group" aria-label={card.title}>
      <div className="app-book-group-head">
        <ActionIcon name="pin" size={18} strokeWidth={2.2} />
        <span className="app-book-group-title">{card.venue}</span>
      </div>
      <button type="button" className="app-book-hero" onClick={onOpenTicket}>
        <AppMedia category={card.category ?? undefined} className="app-book-hero-media" />
        <span className={card.kind === "waitlist" ? "app-book-badge app-book-badge--waiting" : card.kind === "slot" ? "app-book-badge app-book-badge--slot" : "app-book-badge"}>{card.badge}</span>
        <span className="app-book-hero-veil">
          <span className="app-book-hero-title">{card.title}</span>
          <span className="app-book-hero-meta">{card.meta}</span>
        </span>
      </button>
      <div className="app-book-row">
        <span className="app-book-company">
          <span className="app-place-faces" role="img" aria-label={card.company}>
            {card.faces.slice(0, 3).map((face, index) => (
              <span key={index} className="app-place-face app-place-face--small">
                {face}
              </span>
            ))}
          </span>
          <span className="app-book-company-line">{card.company}</span>
        </span>
        {card.kind === "waitlist" ? (
          <button type="button" className="app-book-action" onClick={onLeaveWaitlist}>
            Выйти
          </button>
        ) : card.kind === "ticket" ? (
          <button type="button" className="app-book-action" onClick={onOpenTicket}>
            Перенести
          </button>
        ) : (
          <button type="button" className="app-book-action app-book-action--primary" onClick={onOpenTicket}>
            Билет
            <ActionIcon name="chevron" size={16} strokeWidth={2.6} />
          </button>
        )}
        <button type="button" className="app-book-more" aria-label="Ещё" aria-expanded={menuOpen} onClick={onMenu}>
          <ActionIcon name="dots" size={16} strokeWidth={2.4} />
        </button>
      </div>
      {menuOpen && (
        <div className="app-book-menu">
          <button type="button" onClick={onShare}>
            Поделиться
          </button>
        </div>
      )}
      {card.code !== null && (
        <div className="app-book-code">
          <CodeBlock code={card.code} size={3} className="app-book-code-matrix" />
          <span className="app-book-code-body">
            <span className="app-book-code-label">Код входа</span>
            <span className="app-book-code-value">{card.code}</span>
          </span>
          <button type="button" className="app-book-code-show" onClick={onOpenTicket}>
            Показать
          </button>
        </div>
      )}
    </section>
  );
}

export function MyBookingsView({ board, tab, query, searching, menuId, onTab, onQuery, onToggleSearch, onCalendar, onOpenTicket, onLeaveWaitlist, onMenu, onShare, onRate, onRepeat }: MyBookingsViewProps) {
  const cards = filterBookingCards(board.active, tab, query);
  const showActive = tab !== "past";
  const showPast = tab === "active" || tab === "past";
  return (
    <section className="app-book">
      <div className="app-book-bar">
        <div className="app-book-bar-titles">
          <h1 className="app-book-bar-title">Мои брони</h1>
          <p className="app-book-bar-note">
            {board.activeCount} {pluralRu(board.activeCount, "активная", "активные", "активных")} · {board.pastCount} {pluralRu(board.pastCount, "прошедшая", "прошедших", "прошедших")}
          </p>
        </div>
        <button type="button" className="app-book-search" aria-label="Поиск по броням" aria-expanded={searching} onClick={onToggleSearch}>
          <ActionIcon name="search" size={20} strokeWidth={2.2} />
        </button>
      </div>

      {searching && <input className="app-book-search-field" value={query} placeholder="Площадка или событие" aria-label="Поиск по броням" onChange={(change) => onQuery(change.target.value)} />}

      <div className="app-book-segments">
        <span className="app-book-segment app-book-segment--on">Мои брони</span>
        <button type="button" className="app-book-segment" onClick={onCalendar}>
          Календарь
        </button>
      </div>

      <div className="app-book-filters">
        {BOOKING_TABS.map((item) => (
          <button key={item.id} type="button" className={item.id === tab ? "app-book-filter app-book-filter--on" : "app-book-filter"} aria-pressed={item.id === tab} onClick={() => onTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {showActive && (cards.length === 0 ? <AppState>{query.trim() === "" ? "Здесь пока пусто — забронируй окно или запишись на событие." : "Ничего не нашлось."}</AppState> : cards.map((card) => <BookingCardView key={`${card.kind}-${card.id}`} card={card} menuOpen={menuId === card.id} onOpenTicket={() => onOpenTicket(card)} onLeaveWaitlist={() => onLeaveWaitlist(card.id)} onMenu={() => onMenu(menuId === card.id ? null : card.id)} onShare={() => onShare(card)} />))}

      {showPast && board.past.length > 0 && (
        <section className="app-book-past" aria-label="Прошедшие">
          <div className="app-place-label">Прошедшие</div>
          {board.past.map((card) => (
            <div key={card.eventId} className="app-book-past-card">
              <AppMedia category={card.category} className="app-book-past-media" />
              <span className="app-book-past-body">
                <span className="app-book-past-title">{card.title}</span>
                <span className="app-book-past-meta">{card.meta}</span>
              </span>
              <button type="button" className="app-book-past-action" onClick={() => onRate(card.eventId)}>
                Оценить
              </button>
              <button type="button" className="app-book-past-repeat" onClick={() => onRepeat(card.eventId)}>
                Повторить
              </button>
            </div>
          ))}
        </section>
      )}
    </section>
  );
}

/** Ни одного слота и ни одной очереди — ответ на «слотов на этом сервере нет вовсе», а не на «их у тебя нет». */
const NO_SLOTS: MySlotsBoard = { bookings: [], waitlist: [] };

export function MyBookingsPage() {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const { navigate } = useRoute();
  const [state, setState] = useState<BookingsState>({ status: "loading" });
  const [tab, setTab] = useState<BookingTab>("active");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (userId === null) return () => {};
    let alive = true;
    setState({ status: "loading" });
    // Брони событий — ключевой запрос экрана; слоты и коды входа — домен, которого на бэкенде ещё
    // нет (#492). Их отсутствие оставляет экран без этих карточек, а не вместо экрана.
    Promise.all([apiClient.listMySlots(userId).catch(whenEndpointMissing(NO_SLOTS)), apiClient.listCalendar(), apiClient.listCheckInCodes(userId).catch(whenEndpointMissing<CheckInCode[]>([]))]).then(
      ([slots, calendar, codes]) => {
        if (alive) setState({ status: "ready", board: bookingCards(slots, calendar, codes, new Date()) });
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [userId]);

  useEffect(load, [load]);

  if (state.status === "loading") return <AppSkeletonList rows={4} />;
  if (state.status === "error") return <AppState error>Не удалось загрузить брони.</AppState>;
  const leave = (entryId: string) => {
    apiClient.leaveSlotWaitlist(entryId).then(
      () => load(),
      () => {},
    );
  };
  // Only a booked window has a screen of its own (экран 20). A ticket opens its event, where the
  // booking can be changed; a waiting position opens the venue it is waiting for.
  const open = (card: BookingCard) => {
    if (card.kind === "slot") navigate({ name: "slot-ticket", id: card.id });
    else if (card.eventId !== null) navigate({ name: "event", id: card.eventId });
    else if (card.placeId !== null) navigate({ name: "place", id: card.placeId });
  };
  const share = (card: BookingCard) => {
    setMenuId(null);
    void shareResult(webApp, `${card.title} · ${card.venue}, ${card.meta}`);
  };
  return <MyBookingsView board={state.board} tab={tab} query={query} searching={searching} menuId={menuId} onTab={setTab} onQuery={setQuery} onToggleSearch={() => setSearching((current) => !current)} onCalendar={() => navigate({ name: "calendar" })} onOpenTicket={open} onLeaveWaitlist={leave} onMenu={setMenuId} onShare={share} onRate={(eventId) => navigate({ name: "after-event", eventId })} onRepeat={(eventId) => navigate({ name: "event", id: eventId })} />;
}
