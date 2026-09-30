// START_MODULE_CONTRACT
// PURPOSE: Экран 18 «Запись и лист ожидания»: the sheet over the event card with the fill bar, the entry condition, the promo code fields, the friends already holding tickets, payment at the organizer and the waitlist fallback when the seats are gone.
// SCOPE: Presentational sheet plus its pure copy; booking, payment and waitlist calls belong to the caller (./EventPage.tsx). The sheet renders over the event screen exactly as the design draws it — the scrim keeps the hero and the meta tiles visible behind it.
// DEPENDS: ../api/client.js (BookingOffer, EventDetails), @max-events/api-contracts (Friend), ../catalog/format.js (pluralRu), ../ui/icons.js, ../ui/primitives.js (AppState), ./EventScreen.js (formatPrice, seatOccupancy), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - sheetHeadline - «Мест нет» / «Мест почти нет» / «Есть места» / «Свободный вход» from the seats left
// - SHEET_ALMOST_FULL_SHARE - share of the capacity below which the sheet says «Мест почти нет»
// - seatsFillPercent - width of the fill bar, 0..100; 100 for an event without a capacity to divide by
// - bookingSummary - the paragraph under the bar: what is left, at what price, and where the money goes
// - friendNames - «Катя, Сергей и Ира» — first names, the last one joined with «и»
// - ticketFriendsLine - «Уже с билетами: Катя, Сергей и Ира» (gender-free: the contract carries none)
// - waitlistCtaLabel - «Встать в лист ожидания · 7 впереди»; without a queue the button says just the verb
// - primaryCtaLabel - «Купить билет у организатора» for a paid event, «Записаться» for a free one, «Вы записаны» once booked
// - BookingSheetProps - everything the sheet draws and every action it can fire
// - BookingSheet - экран 18: scrim, grabber, headline with the counter, fill bar, summary, promo fields, friends row, the CTA, the waitlist button and the notify line
// END_MODULE_MAP

import { createPortal } from "react-dom";
import type { Friend } from "@max-events/api-contracts";
import type { BookingOffer, EventDetails } from "../api/client";
import { pluralRu } from "../catalog/format";
import { ActionIcon } from "../ui/icons";
import { useSheetSwipe } from "../ui/sheet";
import { AppState } from "../ui/primitives";
import { formatPrice, seatOccupancy } from "./EventScreen";
import type { PromoCodeState } from "./EventPage";

/** Below a fifth of the capacity the sheet stops saying «есть места» — that is the line the design draws. */
export const SHEET_ALMOST_FULL_SHARE = 0.2;

export function sheetHeadline(details: EventDetails): string {
  const occupancy = seatOccupancy(details);
  if (occupancy === null) return "Свободный вход";
  if (details.remainingSeats === 0) return "Мест нет";
  return (details.remainingSeats ?? 0) <= occupancy.capacity * SHEET_ALMOST_FULL_SHARE ? "Мест почти нет" : "Есть места";
}

/** An event without a capacity has no ratio, and a bar that never fills reads as a broken widget — so it shows full. */
export function seatsFillPercent(details: EventDetails): number {
  const occupancy = seatOccupancy(details);
  if (occupancy === null || occupancy.capacity === 0) return 100;
  return Math.min(100, Math.round((occupancy.taken / occupancy.capacity) * 100));
}

/** Paid in the catalog only counts when there is a price to charge. */
export function eventCharges(event: Pick<EventDetails["event"], "isPaid" | "priceRub">): boolean {
  return event.isPaid && event.priceRub !== null && event.priceRub > 0;
}

export function bookingSummary(details: EventDetails, organizerName: string | null): string {
  const { event, remainingSeats } = details;
  const charged = eventCharges(event);
  const named = organizerName !== null && organizerName.trim() !== "" && organizerName !== "Организатор не указан" ? organizerName : null;
  const seatNoun = charged ? (["билет", "билета", "билетов"] as const) : (["место", "места", "мест"] as const);
  // «Осталось 0 билетов» — это не ответ, а арифметика вслух: у распроданного события своя история, про очередь
  if (remainingSeats === 0) return `${charged ? "Билеты" : "Места"} разобрали. Освободившееся уходит первому в листе ожидания — очередь двигается сама.`;
  const sentences: string[] = [];
  if (remainingSeats !== null) sentences.push(`Осталось ${remainingSeats} ${pluralRu(remainingSeats, seatNoun[0], seatNoun[1], seatNoun[2])}${charged ? ` по ${formatPrice(event)}` : ""}.`);
  else if (charged) sentences.push(`Вход по билету — ${formatPrice(event)}.`);
  else sentences.push("Вход свободный.");
  if (charged) sentences.push(named === null ? "Оплата на стороне организатора." : `Оплата на сайте организатора — «${named}».`);
  sentences.push(charged ? "После оплаты вернись и подтверди участие, чтобы друзья видели тебя в плане." : "Запись держит место за тобой — друзья увидят тебя в плане.");
  return sentences.join(" ");
}

/** «Катя, Сергей и Ира»: first names only, because the row is about recognition and not about records. */
export function friendNames(friends: Friend[]): string {
  const names = friends.map((friend) => friend.name.split(" ")[0]);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} и ${names[names.length - 1]}`;
}

/**
 * «Уже с билетами: Катя». The design writes «Катя, Сергей и Ира уже купили», which needs a gender the
 * Friend contract does not carry and a plural the count decides — one name would read «Катя уже
 * купили». The noun phrase says the same thing and stays right for one person or five.
 */
export function ticketFriendsLine(friends: Friend[]): string | null {
  return friends.length === 0 ? null : `Уже с билетами: ${friendNames(friends)}`;
}

export function waitlistCtaLabel(ahead: number): string {
  return ahead === 0 ? "Встать в лист ожидания" : `Встать в лист ожидания · ${ahead} ${pluralRu(ahead, "впереди", "впереди", "впереди")}`;
}

export function primaryCtaLabel(details: EventDetails): string {
  if (details.activeBookingId !== null) return "Вы записаны";
  return eventCharges(details.event) ? "Купить билет у организатора" : "Записаться";
}

export interface BookingSheetProps {
  details: EventDetails;
  offer: BookingOffer | null;
  organizerName: string | null;
  promo: PromoCodeState;
  /** Waitlist block of the sold-out state; the caller decides whether the viewer can still queue. */
  waitlist: { ahead: number; joined: boolean; onJoin: () => void } | null;
  onClose: () => void;
  onBook: () => void;
  onCancel: () => void;
}

export function BookingSheet({ details, offer, organizerName, promo, waitlist, onClose, onBook, onCancel }: BookingSheetProps) {
  const swipe = useSheetSwipe(onClose);
  const booked = details.activeBookingId !== null;
  const soldOut = details.remainingSeats === 0;
  const friends = offer?.friendsWithTickets ?? [];
  const friendsLine = ticketFriendsLine(friends);
  const opensAt = details.event.bookingOpensAt;
  const earlyAccess = opensAt !== null && new Date(opensAt).getTime() > Date.now();
  const occupancy = seatOccupancy(details);
  const view = (
    <div className="app-evb" role="dialog" aria-modal="true" aria-label="Запись на событие">
      <button type="button" className="app-evb-scrim" aria-label="Закрыть" onClick={onClose} />
      <div className="app-evb-sheet app-sheet" style={swipe.style}>
        <div className="app-sheet-grab" aria-hidden="true" {...swipe.grab} />
        <div className="app-evb-body">
          <div className="app-evb-head">
            <h2 className="app-evb-title">{sheetHeadline(details)}</h2>
            {occupancy !== null && (
              <span className="app-evb-count">
                {occupancy.taken} из {occupancy.capacity}
              </span>
            )}
          </div>
          <div className="app-evb-bar" aria-hidden="true">
            <span className="app-evb-bar-fill" style={{ width: `${seatsFillPercent(details)}%` }} />
          </div>
          <p className="app-evb-summary">{bookingSummary(details, organizerName)}</p>
          {friendsLine !== null && (
            <div className="app-evb-friends">
              <span className="app-evb-faces" role="img" aria-label={friendsLine}>
                {friends.slice(0, 3).map((friend) => (
                  <span key={friend.id} className="app-evb-face">
                    {friend.name.charAt(0)}
                  </span>
                ))}
              </span>
              <p className="app-evb-friends-text">
                {friendsLine}. <b>Позвать в общий план</b> после оплаты.
              </p>
            </div>
          )}
          {!booked && !soldOut && (
            <div className="app-evb-promo">
              {earlyAccess && <p className="app-evb-early">Запись пока открыта по промокоду раннего доступа.</p>}
              <input className="app-evb-input" type="text" value={promo.code} aria-label="Промокод" placeholder="Промокод (если есть)" onChange={(change) => promo.onCode(change.target.value)} />
              <input className="app-evb-input" type="text" value={promo.referral} aria-label="Код акции или друга" placeholder="Код акции или друга (если есть)" onChange={(change) => promo.onReferral(change.target.value)} />
            </div>
          )}
          {promo.error !== null && <AppState error>{promo.error}</AppState>}
        </div>
        <div className="app-evb-actions">
          {booked ? (
            <button type="button" className="app-evb-cta app-evb-cta--booked" onClick={onCancel}>
              Отменить запись
            </button>
          ) : (
            <button type="button" className="app-evb-cta" disabled={soldOut} onClick={onBook}>
              {primaryCtaLabel(details)}
              {eventCharges(details.event) && <ActionIcon name="arrow" size={18} />}
            </button>
          )}
          {waitlist !== null && (
            <>
              <button type="button" className="app-evb-waitlist" disabled={waitlist.joined} onClick={waitlist.onJoin}>
                {waitlist.joined ? "Вы в листе ожидания" : waitlistCtaLabel(waitlist.ahead)}
              </button>
              <p className="app-evb-note">Уведомим, если освободится место</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
  const host = typeof document === "undefined" ? null : (document.querySelector(".app-root") ?? document.body);
  return host === null ? view : createPortal(view, host);
}
