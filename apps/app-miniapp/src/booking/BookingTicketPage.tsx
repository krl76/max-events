// START_MODULE_CONTRACT
// PURPOSE: Экран 20 «Бронь и код входа»: the confirmation of a booked window — the gradient header with the venue and the way to it, the entry code, the four facts of the booking, the route and calendar actions, the booking chat, the invite row and the cancellation.
// SCOPE: Reads apiClient.getSlotBooking and writes apiClient.cancelSlotBooking (mock-backed, #492); sharing goes through the MAX bridge, the route and the calendar hand over to the existing screens. No chat input: the chat has no domain to write to.
// DEPENDS: ../api/client.js (apiClient, SlotBookingScreen), ../max/bridge.js (shareResult, webApp), ../place/slots.js, ../routing/router.js, ../ui/icons.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - chatMembersLabel - «Ты, Анна, Дима и площадка» over the chat
// - ticketWhen - «Пятница, 19 сентября · 17:30» over the venue name
// - ticketPlaceLine - «Серебряный Бор · 2,4 км · 15 мин»; the distance drops out when routing has nothing to say
// - partyLabel - «3 человека» of the facts row
// - inviteLine - «Стол на 12, свободно 9 мест» under «Позвать ещё друзей»
// - ticketShareText - what the share sheet sends into a MAX chat
// - CodeBlock - the placeholder of the scannable code, drawn from the code itself
// - BookingTicketState - union of the ticket fetch states (loading / error / ready)
// - BookingTicketView - presentational: the whole screen with its actions lifted out
// - BookingTicketPage - route container: loads the booking, cancels it behind a confirmation, shares and navigates
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import type { Friend } from "@max-events/api-contracts";
import { apiClient, type SlotBookingScreen } from "../api/client";
import { shareResult, webApp } from "../max/bridge";
import { sharePayload } from "../max/links";
import { codeMatrix, formatRub, formatSlotWindow, formatTime, type CodeCell } from "../place/slots";
import { useRoute } from "../routing/router";
import { pluralRu } from "../catalog/format";
import { ActionIcon } from "../ui/icons";
import { AppSkeletonList, AppState } from "../ui/primitives";

/** «Пятница, 19 сентября · 17:30» — the full weekday of the design, capitalised. */
export function ticketWhen(startsAt: string): string {
  const date = new Date(startsAt);
  const weekday = date.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow", weekday: "long" });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${date.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow", day: "numeric", month: "long" })} · ${formatTime(startsAt)}`;
}

/** «Серебряный Бор · 2,4 км · 15 мин»; without a travel estimate (#504) the venue stands alone. */
export function ticketPlaceLine(screen: Pick<SlotBookingScreen, "place" | "distanceKm" | "travelMinutes">): string {
  const parts = [screen.place.title];
  if (screen.distanceKm !== null) parts.push(`${screen.distanceKm.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} км`);
  if (screen.travelMinutes !== null) parts.push(`${screen.travelMinutes} мин`);
  return parts.join(" · ");
}

export function partyLabel(partySize: number): string {
  return `${partySize} ${pluralRu(partySize, "человек", "человека", "человек")}`;
}

/** «Стол на 12, свободно 9 мест»; a full table says so instead of promising nothing. */
export function inviteLine(screen: Pick<SlotBookingScreen, "slot" | "freeSeats">): string {
  const table = `Стол на ${screen.slot.capacity}`;
  if (screen.freeSeats === 0) return `${table}, мест больше нет`;
  return `${table}, свободно ${screen.freeSeats} ${pluralRu(screen.freeSeats, "место", "места", "мест")}`;
}

/** «Ты, Анна, Дима и площадка» — the venue is a member of every booking chat, and the design names it last. */
export function chatMembersLabel(company: Friend[]): string {
  const names = ["Ты", ...company.map((friend) => friend.name.split(" ")[0]), "площадка"];
  return `${names.slice(0, -1).join(", ")} и ${names[names.length - 1]}`;
}

export function ticketShareText(screen: Pick<SlotBookingScreen, "unitTitle" | "place" | "slot">): string {
  return `${screen.unitTitle} · ${screen.place.title}, ${ticketWhen(screen.slot.startsAt)}. Присоединяйся!`;
}

const CELL_CLASS: Record<CodeCell, string> = { off: "app-ticket-cell", on: "app-ticket-cell app-ticket-cell--on", accent: "app-ticket-cell app-ticket-cell--accent" };

/**
 * The block above the code stands in for the scannable symbol: MAX gives a mini-app no scanner and
 * the backend issues no code at all (#492). It carries no information, so assistive tech skips it
 * and reads the code itself, which is right under it.
 */
export function CodeBlock({ code, size = 7, className }: { code: string; size?: number; className?: string }) {
  return (
    <span className={className ?? "app-ticket-matrix"} aria-hidden="true">
      {codeMatrix(code, size).map((cell, index) => (
        <span key={index} className={CELL_CLASS[cell]} />
      ))}
    </span>
  );
}

export type BookingTicketState = { status: "loading" } | { status: "error" } | { status: "ready"; screen: SlotBookingScreen };

interface BookingTicketViewProps {
  screen: SlotBookingScreen;
  confirming: boolean;
  busy: boolean;
  failed: boolean;
  shared: string | null;
  onBack: () => void;
  onRoute: () => void;
  onCalendar: () => void;
  onShare: () => void;
  onCancel: () => void;
}

export function BookingTicketView({ screen, confirming, busy, failed, shared, onRoute, onCalendar, onShare, onCancel }: BookingTicketViewProps) {
  const { booking, slot } = screen;
  const cancelled = booking.status === "cancelled";
  return (
    <section className="app-ticket">
      <header className="app-ticket-bar">
        <h1 className="app-ticket-bar-title">{cancelled ? "Бронь отменена" : "Бронь подтверждена"}</h1>
      </header>

      <div className="app-ticket-body">
        <div className="app-ticket-card">
          <div className="app-ticket-hero">
            <span className="app-ticket-blob" aria-hidden="true" />
            <span className="app-ticket-when">
              <span className="app-ticket-when-dot" aria-hidden="true" />
              {ticketWhen(slot.startsAt)}
            </span>
            <span className="app-ticket-title">{screen.unitTitle}</span>
            <span className="app-ticket-place">{ticketPlaceLine(screen)}</span>
          </div>

          <div className="app-ticket-code">
            <CodeBlock code={booking.checkInCode} />
            <span className="app-ticket-value">{booking.checkInCode}</span>
            <span className="app-ticket-hint">Покажите код на входе — организатор отметит вас в списке</span>
          </div>

          <dl className="app-ticket-facts">
            <div className="app-ticket-fact">
              <dt>Слот</dt>
              <dd>{formatSlotWindow(slot)}</dd>
            </div>
            <div className="app-ticket-fact">
              <dt>Компания</dt>
              <dd>{partyLabel(booking.partySize)}</dd>
            </div>
            <div className="app-ticket-fact">
              <dt>Оплачено</dt>
              <dd>{formatRub(booking.totalRub)}</dd>
            </div>
            <div className="app-ticket-fact">
              <dt>Отмена</dt>
              <dd>{booking.cancelBefore === null ? "по правилам площадки" : `до ${formatTime(booking.cancelBefore)}`}</dd>
            </div>
          </dl>
        </div>

        <div className="app-ticket-actions">
          <button type="button" className="app-ticket-action" onClick={onRoute}>
            <ActionIcon name="navigation" size={18} strokeWidth={2.2} />
            Маршрут
          </button>
          <button type="button" className="app-ticket-action" onClick={onCalendar}>
            <ActionIcon name="calendar" size={18} strokeWidth={2.2} />В календарь
          </button>
        </div>

        <section className="app-ticket-chat" aria-label="Чат брони">
          <h2 className="app-ticket-chat-title">Чат брони</h2>
          <p className="app-ticket-chat-members">{chatMembersLabel(screen.company)}</p>
          {screen.chat.length === 0 ? (
            <AppState>В чате пока тихо.</AppState>
          ) : (
            screen.chat.map((message) => (
              <div key={message.id} className="app-ticket-message">
                <span className="app-ticket-message-face" aria-hidden="true">
                  {message.authorName
                    .split(" ")
                    .map((word) => word.charAt(0))
                    .join("")
                    .slice(0, 2)}
                </span>
                <span className="app-ticket-message-text">
                  <span className="app-ticket-message-author">{message.authorName}</span>
                  {message.text}
                </span>
              </div>
            ))
          )}
        </section>

        <div className="app-ticket-invite">
          <span className="app-ticket-invite-body">
            <span className="app-ticket-invite-title">Позвать ещё друзей</span>
            <span className="app-ticket-invite-line">{inviteLine(screen)}</span>
          </span>
          <button type="button" className="app-ticket-share" disabled={screen.freeSeats === 0} onClick={onShare}>
            Поделиться
          </button>
        </div>

        {shared !== null && <p className="app-ticket-shared">{shared}</p>}
        {failed && <AppState error>Не удалось отменить бронь.</AppState>}

        {!cancelled && (
          <button type="button" className={confirming ? "app-ticket-cancel app-ticket-cancel--confirm" : "app-ticket-cancel"} disabled={busy} onClick={onCancel}>
            {confirming ? "Точно отменить бронь?" : "Отменить бронь"}
          </button>
        )}
      </div>
    </section>
  );
}

export function BookingTicketPage({ id }: { id: string }) {
  const { navigate, back } = useRoute();
  const [state, setState] = useState<BookingTicketState>({ status: "loading" });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [shared, setShared] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    apiClient.getSlotBooking(id).then(
      (screen) => {
        if (alive) setState({ status: "ready", screen });
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [id, attempt]);

  const cancel = useCallback(() => {
    if (busy) return;
    // Cancelling is irreversible, so the first press only arms the button — the second one does it.
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    setFailed(false);
    apiClient.cancelSlotBooking(id).then(
      (booking) => {
        setBusy(false);
        setConfirming(false);
        setState((current) => (current.status === "ready" ? { status: "ready", screen: { ...current.screen, booking } } : current));
      },
      () => {
        setBusy(false);
        setConfirming(false);
        setFailed(true);
      },
    );
  }, [busy, confirming, id]);

  if (state.status === "loading") return <AppSkeletonList rows={3} />;
  if (state.status === "error")
    return (
      <AppState error action={{ label: "Повторить", onClick: () => setAttempt((n) => n + 1) }}>
        Не удалось загрузить бронь.
      </AppState>
    );
  const share = () => {
    const payload = sharePayload(ticketShareText(state.screen), `booking-${id}`);
    void shareResult(webApp, payload.text, payload.link).then((channel) => setShared(channel === "bridge" ? "Отправили в чат" : channel === "clipboard" ? "Скопировали приглашение" : "Поделиться не получилось"));
  };
  return <BookingTicketView screen={state.screen} confirming={confirming} busy={busy} failed={failed} shared={shared} onBack={back} onRoute={() => navigate({ name: "map" })} onCalendar={() => navigate({ name: "calendar" })} onShare={share} onCancel={cancel} />;
}
