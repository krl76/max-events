// START_MODULE_CONTRACT
// PURPOSE: Event details page: full event fields, booking button states (book / booked / sold out), external payment link, participation status selector and counters.
// SCOPE: Data via apiClient.getEventDetails (mock or live), booking create/cancel through apiClient, payment via openExternalLink, participation stats/status write via apiClient, post-event review section and report button; no navigation logic.
// DEPENDS: ../api/client.js (apiClient, EventDetails, ParticipationStats), @max-events/api-contracts (ParticipationStatus), ../auth/AuthContext.js, ../max/bridge.js (openExternalLink), ../catalog/CatalogPage.js (CATEGORY_LABELS, formatStartsAt), ./SaveToList.js (SaveToList), ./ReviewSection.js (ReviewSection), ./ReportButton.js (ReportButton), ../feed/FeedPage.js (FeedSection), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - DEMO_USER_ID - fallback booking owner outside the MAX client (mock/dev mode)
// - EventDetailsState - union of details fetch states (loading / error / ready)
// - EventDetailsView - presentational: media, title, meta rows (place title opens the place page), description, booking CTA, check-in button, buy button
// - EventPage - route container: resolves the user id, wires booking/check-in actions and the payment link, entry to the gathering flow
// - PARTICIPATION_STATUS_LABELS - human-readable labels for the 6 participation statuses
// - ParticipationView - presentational: status chip selector, clear button, status counters and friends count
// - ParticipationSection - container: loads participation stats via apiClient and wires set/clear actions
// - ReviewSection, ReportButton, FeedSection - post-event review flow (#144), the report button (#167) and the event wall (recent impression posts), see their files
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import { apiClient, type EventDetails, type ParticipationStats } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { CATEGORY_LABELS, formatStartsAt } from "../catalog/CatalogPage";
import { ParticipationStatusSchema, type ParticipationStatus } from "@max-events/api-contracts";
import { openExternalLink } from "../max/bridge";
import { useRoute } from "../routing/router";
import { AppButton, AppChip, AppTitle } from "../ui/primitives";
import { ActionIcon } from "../ui/icons";
import { SaveToList } from "./SaveToList";
import { FeedSection } from "../feed/FeedPage";
import { ReviewSection } from "./ReviewSection";
import { ReportButton } from "./ReportButton";

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
      <AppButton onClick={onCancel} stretched tone="secondary">
        Вы записаны
      </AppButton>
    );
  }
  if (details.remainingSeats === 0) {
    return (
      <AppButton disabled stretched>
        Мест нет
      </AppButton>
    );
  }
  return (
    <AppButton onClick={onBook} stretched>
      Записаться
    </AppButton>
  );
}

function CheckInCta({ checkedIn, onCheckIn }: { checkedIn: boolean; onCheckIn: () => void }) {
  if (checkedIn) {
    return (
      <AppButton disabled stretched tone="secondary">
        Вы были здесь
      </AppButton>
    );
  }
  return (
    <AppButton onClick={onCheckIn} stretched tone="secondary">
      Я здесь
    </AppButton>
  );
}

interface EventDetailsViewProps {
  details: EventDetails;
  onBook: () => void;
  onCancel: () => void;
  onCheckIn: () => void;
  onBuy: (url: string) => void;
  onOpenPlace: (id: string) => void;
}

export function EventDetailsView({ details, onBook, onCancel, onCheckIn, onBuy, onOpenPlace }: EventDetailsViewProps) {
  const { event, place, organizer } = details;
  const paymentUrl = event.isPaid ? event.paymentUrl : null;
  const organizerName = [organizer.firstName, organizer.lastName].filter(Boolean).join(" ");

  return (
    <article className="app-event">
      <div className="app-event-media" />
      <div className="app-event-body">
        <AppTitle asChild>
          <h1 className="app-event-title">{event.title}</h1>
        </AppTitle>
        <dl className="app-event-meta">
          <div className="app-event-meta-row">
            <dt>
              <span className="app-event-meta-ico">
                <ActionIcon name="clock" size={20} strokeWidth={1.5} />
              </span>
              Когда
            </dt>
            <dd>{formatStartsAt(event.startsAt)}</dd>
          </div>
          <div className="app-event-meta-row">
            <dt>
              <span className="app-event-meta-ico">
                <ActionIcon name="pin" size={20} strokeWidth={1.5} />
              </span>
              Где
            </dt>
            <dd>
              {place ? (
                <button type="button" className="app-plan-event" onClick={() => onOpenPlace(place.id)}>
                  {place.title}
                </button>
              ) : (
                event.city
              )}
            </dd>
            {place && <dd className="app-place-meta-address">{place.address}</dd>}
          </div>
          <div className="app-event-meta-row">
            <dt>Категория</dt>
            <dd>{CATEGORY_LABELS[event.category]}</dd>
          </div>
          <div className="app-event-meta-row">
            <dt>
              <span className="app-event-meta-ico">
                <ActionIcon name="ticket" size={20} strokeWidth={1.5} />
              </span>
              Вход
            </dt>
            <dd>{event.priceRub === null ? "Бесплатно" : `${event.priceRub} ₽`}</dd>
          </div>
          <div className="app-event-meta-row">
            <dt>
              <span className="app-event-meta-ico">
                <ActionIcon name="user" size={20} strokeWidth={1.5} />
              </span>
              Организатор
            </dt>
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
        <div className="app-event-actions">
          <BookingCta details={details} onBook={onBook} onCancel={onCancel} />
          <CheckInCta checkedIn={details.checkInId !== null} onCheckIn={onCheckIn} />
          {paymentUrl !== null && (
            <AppButton onClick={() => onBuy(paymentUrl)} stretched tone="secondary">
              Купить билет
            </AppButton>
          )}
        </div>
      </div>
    </article>
  );
}

export const PARTICIPATION_STATUS_LABELS: Record<ParticipationStatus, string> = {
  wants_to_go: "Хочу пойти",
  probably_going: "Скорее всего пойду",
  going: "Иду",
  looking_for_company: "Ищу компанию",
  looking_for_travel_buddy: "Ищу попутчика",
  looking_for_after_event_company: "Ищу, с кем продолжить после события",
};

const PARTICIPATION_COUNTER_LABELS: Record<ParticipationStatus, string> = {
  wants_to_go: "Хотят пойти",
  probably_going: "Скорее всего пойдут",
  going: "Идут",
  looking_for_company: "Ищут компанию",
  looking_for_travel_buddy: "Ищут попутчика",
  looking_for_after_event_company: "Ищут, с кем продолжить после события",
};

const PARTICIPATION_STATUSES = ParticipationStatusSchema.options;

interface ParticipationViewProps {
  stats: ParticipationStats;
  onSet: (status: ParticipationStatus) => void;
  onClear: () => void;
}

export function ParticipationView({ stats, onSet, onClear }: ParticipationViewProps) {
  return (
    <section className="app-event">
      <div className="app-event-body">
        <AppTitle asChild>
          <h2 className="app-participation-title">Твой статус</h2>
        </AppTitle>
        <div className="app-participation-chips">
          {PARTICIPATION_STATUSES.map((status) => (
            <AppChip key={status} pressed={stats.myStatus === status} onClick={() => onSet(status)}>
              {PARTICIPATION_STATUS_LABELS[status]}
            </AppChip>
          ))}
        </div>
        {stats.myStatus !== null && (
          <button type="button" className="app-participation-clear" onClick={onClear}>
            Снять статус
          </button>
        )}
        <ul className="app-participation-counters">
          {PARTICIPATION_STATUSES.filter((status) => stats.counts[status] > 0).map((status) => (
            <li key={status}>
              {PARTICIPATION_COUNTER_LABELS[status]}: {stats.counts[status]}
            </li>
          ))}
          {stats.friendsCount > 0 && <li>Твои знакомые: {stats.friendsCount}</li>}
        </ul>
      </div>
    </section>
  );
}

export function ParticipationSection({ eventId, userId }: { eventId: string; userId: string }) {
  const [stats, setStats] = useState<ParticipationStats | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    apiClient.getParticipationStats(eventId, userId).then(
      (next) => {
        setStats(next);
        setFailed(false);
      },
      () => setFailed(true),
    );
  }, [eventId, userId]);
  useEffect(() => {
    load();
  }, [load]);

  const setStatus = useCallback(
    (status: ParticipationStatus) => {
      apiClient.setParticipationStatus(eventId, userId, status).then(load, load);
    },
    [eventId, userId, load],
  );

  const clear = useCallback(() => {
    apiClient.deleteParticipation(eventId, userId).then(load, load);
  }, [eventId, userId, load]);

  if (stats === null) {
    return <p className={`app-state${failed ? " app-state--error" : ""}`}>{failed ? "Не удалось загрузить статусы." : "Загрузка…"}</p>;
  }
  return <ParticipationView stats={stats} onSet={setStatus} onClear={clear} />;
}

export function EventPage({ id }: { id: string }) {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : DEMO_USER_ID;
  const { navigate } = useRoute();
  const [state, refetch] = useEventDetails(id, userId);

  const book = useCallback(() => {
    apiClient.createBooking({ userId, eventId: id }).then(refetch, refetch);
  }, [userId, id, refetch]);

  const cancel = useCallback(() => {
    if (state.status !== "ready" || state.details.activeBookingId === null) return;
    apiClient.cancelBooking(state.details.activeBookingId).then(refetch, refetch);
  }, [state, refetch]);

  const checkIn = useCallback(() => {
    apiClient.createCheckIn({ userId, eventId: id }).then(refetch, refetch);
  }, [userId, id, refetch]);

  if (state.status === "loading") return <p className="app-state">Загрузка…</p>;
  if (state.status === "error") return <p className="app-state app-state--error">Не удалось загрузить событие.</p>;
  return (
    <>
      <EventDetailsView details={state.details} onBook={book} onCancel={cancel} onCheckIn={checkIn} onBuy={openExternalLink} onOpenPlace={(placeId) => navigate({ name: "place", id: placeId })} />
      <SaveToList eventId={id} userId={userId} />
      <section className="app-event">
        <div className="app-event-body">
          <AppButton onClick={() => navigate({ name: "gathering-new", eventId: id })} stretched>
            Собрать компанию
          </AppButton>
        </div>
      </section>
      <ParticipationSection eventId={id} userId={userId} />
      <FeedSection eventId={id} onCreate={() => navigate({ name: "feed-new", eventId: id })} />
      <ReviewSection eventId={id} userId={userId} canReview={state.details.activeBookingId !== null && new Date(state.details.event.startsAt).getTime() < Date.now()} />
      <ReportButton eventId={id} userId={userId} />
    </>
  );
}
