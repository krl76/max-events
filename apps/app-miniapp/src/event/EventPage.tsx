// START_MODULE_CONTRACT
// PURPOSE: Event details page: full event fields, booking button states (book / booked / sold out), external payment link.
// SCOPE: Data via apiClient.getEventDetails (mock or live), booking create/cancel through apiClient, payment via openExternalLink; no navigation logic.
// DEPENDS: ../api/client.js (apiClient, EventDetails), ../auth/AuthContext.js, ../max/bridge.js (openExternalLink), ../catalog/CatalogPage.js (CATEGORY_LABELS, formatStartsAt), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - DEMO_USER_ID - fallback booking owner outside the MAX client (mock/dev mode)
// - EventDetailsState - union of details fetch states (loading / error / ready)
// - EventDetailsView - presentational: media, title, meta rows, description, booking CTA, buy button
// - EventPage - route container: resolves the user id, wires booking actions and the payment link
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import { apiClient, type EventDetails } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { CATEGORY_LABELS, formatStartsAt } from "../catalog/CatalogPage";
import { openExternalLink } from "../max/bridge";

export const DEMO_USER_ID = "a0000000-0000-4000-8000-000000000001";

export type EventDetailsState = { status: "loading" } | { status: "error" } | { status: "ready"; details: EventDetails };

function useEventDetails(id: string, userId: string): [EventDetailsState, () => void] {
  const [state, setState] = useState<EventDetailsState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    apiClient.getEventDetails(id, userId).then(
      (details) => {
        if (alive) setState({ status: "ready", details });
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [id, userId, attempt]);

  return [state, useCallback(() => setAttempt((n) => n + 1), [])];
}

interface BookingCtaProps {
  details: EventDetails;
  onBook: () => void;
  onCancel: () => void;
}

function BookingCta({ details, onBook, onCancel }: BookingCtaProps) {
  if (details.activeBookingId !== null) {
    return (
      <button type="button" className="app-event-cta app-event-cta--booked" onClick={onCancel}>
        Вы записаны
      </button>
    );
  }
  if (details.remainingSeats === 0) {
    return (
      <button type="button" className="app-event-cta" disabled>
        Мест нет
      </button>
    );
  }
  return (
    <button type="button" className="app-event-cta" onClick={onBook}>
      Записаться
    </button>
  );
}

interface EventDetailsViewProps {
  details: EventDetails;
  onBook: () => void;
  onCancel: () => void;
  onBuy: (url: string) => void;
}

export function EventDetailsView({ details, onBook, onCancel, onBuy }: EventDetailsViewProps) {
  const { event, place, organizer } = details;
  const paymentUrl = event.isPaid ? event.paymentUrl : null;
  const organizerName = [organizer.firstName, organizer.lastName].filter(Boolean).join(" ");

  return (
    <article className="app-event">
      <div className="app-event-media" />
      <div className="app-event-body">
        <h1 className="app-event-title">{event.title}</h1>
        <dl className="app-event-meta">
          <div className="app-event-meta-row">
            <dt>Когда</dt>
            <dd>{formatStartsAt(event.startsAt)}</dd>
          </div>
          <div className="app-event-meta-row">
            <dt>Где</dt>
            <dd>{place ? `${place.title}, ${place.address}` : event.city}</dd>
          </div>
          <div className="app-event-meta-row">
            <dt>Категория</dt>
            <dd>{CATEGORY_LABELS[event.category]}</dd>
          </div>
          <div className="app-event-meta-row">
            <dt>Вход</dt>
            <dd>{event.priceRub === null ? "Бесплатно" : `${event.priceRub} ₽`}</dd>
          </div>
          <div className="app-event-meta-row">
            <dt>Организатор</dt>
            <dd>{organizerName}</dd>
          </div>
          {details.remainingSeats !== null && (
            <div className="app-event-meta-row">
              <dt>Свободные места</dt>
              <dd>Осталось {details.remainingSeats}</dd>
            </div>
          )}
        </dl>
        {event.description !== "" && <p className="app-event-description">{event.description}</p>}
        <BookingCta details={details} onBook={onBook} onCancel={onCancel} />
        {paymentUrl !== null && (
          <button type="button" className="app-event-cta app-event-cta--buy" onClick={() => onBuy(paymentUrl)}>
            Купить билет
          </button>
        )}
      </div>
    </article>
  );
}

export function EventPage({ id }: { id: string }) {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : DEMO_USER_ID;
  const [state, refetch] = useEventDetails(id, userId);

  const book = useCallback(() => {
    apiClient.createBooking({ userId, eventId: id }).then(refetch, refetch);
  }, [userId, id, refetch]);

  const cancel = useCallback(() => {
    if (state.status !== "ready" || state.details.activeBookingId === null) return;
    apiClient.cancelBooking(state.details.activeBookingId).then(refetch, refetch);
  }, [state, refetch]);

  if (state.status === "loading") return <p className="app-state">Загрузка…</p>;
  if (state.status === "error") return <p className="app-state app-state--error">Не удалось загрузить событие.</p>;
  return <EventDetailsView details={state.details} onBook={book} onCancel={cancel} onBuy={openExternalLink} />;
}
