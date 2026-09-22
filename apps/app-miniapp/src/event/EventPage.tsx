// START_MODULE_CONTRACT
// PURPOSE: Event details page: full event fields, booking button states (book / booked / sold out) with the promo code field (#202) and the early-access «Запись откроется …» line (#313), «Промо» badge for promoted events, in-app payment block for the active booking (#213), external payment link, participation status selector and counters, «Собрать план» autoplan entry once booked.
// SCOPE: Data via apiClient.getEventDetails (mock or live), booking create/cancel through apiClient, waitlist section when sold out, in-app payment via apiClient.payBooking (status/amount strictly from BookingWithSeats.payment) plus the external link via openExternalLink, participation stats/status write via apiClient, post-event review section and report button; no navigation logic.
// DEPENDS: ../api/client.js (apiClient, trackPageView, EventDetails, ParticipationStats), @max-events/api-contracts (ParticipationStatus, Payment), ../auth/AuthContext.js, ../max/bridge.js (openExternalLink), ../catalog/CatalogPage.js (CATEGORY_LABELS, formatStartsAt), ../catalog/format.js (formatEventWeatherDetail, pluralRu), ./SaveToList.js (SaveToList), ./ReviewSection.js (ReviewSection), ./ReportButton.js (ReportButton), ./WaitlistSection.js (WaitlistSection), ./PaymentSection.js (PaymentSection), ../plans/AutoPlanSection.js (AutoPlanSection), ../feed/FeedPage.js (FeedSection), ../organizer/OrganizerAddons.js (EventOrganizerRatingCard), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - EventDetailsState - union of details fetch states (loading / error / ready)
// - bookingErrorMessage - booking failure -> inline text: 403 = promo code rejected / early access needs a code, 409 = sold out (#202)
// - PromoCodeState - promo code fields state of the booking flow (discount code, referral/campaign code, inline error, onCode/onReferral) (#372)
// - EventDetailsView - presentational: 16:9 media with the title/date/category overlay (+ «Промо» marker), meta rows (place, optional weather, category), description, booking CTA with the promo code field, check-in and buy buttons in one secondary row
// - EventPage - route container: resolves the user id from the auth context (loading until authenticated), wires booking/check-in actions and the payment link, loads/keeps the booking payment via payBooking (silent auto-load for paid bookings; errors only on an explicit tap, keyed to the failed booking so a re-book resets them), entry to the gathering flow; records the page view fire-and-forget once auth resolved (#196) and shows the organizer rating card (#199)
// - AutoPlanEntry - «Собрать план» autoplan section gate: rendered only with an active booking
// - PARTICIPATION_STATUS_LABELS - human-readable labels for the 6 participation statuses
// - participationSummary - «N идут · N друзей · N ищут компанию», zeros included
// - ParticipationView - presentational: status select (empty option clears), the matchmaking summary line and the per-status counters
// - ParticipationSection - container: loads participation stats via apiClient and wires set/clear actions
// - ReviewSection, ReportButton, FeedSection, WaitlistSection - post-event review flow (#144), the report button (#167), the event wall (recent impression posts) and the sold-out waitlist block (#260), see their files
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiClient, trackPageView, type EventDetails, type ParticipationStats } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { CATEGORY_LABELS, formatStartsAt } from "../catalog/CatalogPage";
import { formatEventWeatherDetail, pluralRu } from "../catalog/format";
import { ParticipationStatusSchema, type ParticipationStatus, type Payment } from "@max-events/api-contracts";
import { openChatLink, openExternalLink } from "../max/bridge";
import { SubscribeToggle } from "../subscriptions/SubscribeToggle";
import { useRoute } from "../routing/router";
import { AppButton, AppText, AppTitle, AppState } from "../ui/primitives";
import { ActionIcon } from "../ui/icons";
import { SaveToList } from "./SaveToList";
import { FeedSection } from "../feed/FeedPage";
import { ReviewSection } from "./ReviewSection";
import { ReportButton } from "./ReportButton";
import { WaitlistSection } from "./WaitlistSection";
import { PaymentSection } from "./PaymentSection";
import { AutoPlanSection } from "../plans/AutoPlanSection";
import { EventOrganizerRatingCard } from "../organizer/OrganizerAddons";

export type EventDetailsState = { status: "loading" } | { status: "error" } | { status: "ready"; details: EventDetails };

function useEventDetails(id: string, userId: string | null): [EventDetailsState, () => void] {
  const [state, setState] = useState<EventDetailsState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (userId === null) return;
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
      <AppButton disabled tone="secondary">
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
  onOpenChat: (url: string) => void;
  promo?: PromoCodeState;
}

/** Promo code fields state of the booking flow (#202/#372): present only while the event is bookable. The backend keeps the discount promoCode and the referral/campaign referralCode apart (BookingsService.create parity). */
export interface PromoCodeState {
  code: string;
  referral: string;
  error: string | null;
  onCode: (value: string) => void;
  onReferral: (value: string) => void;
}

/** Booking failure -> inline message: the backend maps promo code rejection and the early-access window to 403, sold out to 409 (PromoService.redeemInTransaction / BookingsService parity). */
export function bookingErrorMessage(error: unknown, hadCode: boolean): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return hadCode ? "Промокод не подошёл — проверьте код и срок его действия." : "Запись пока открыта по промокоду раннего доступа — введите код.";
    if (error.status === 409) return "К сожалению, места закончились.";
  }
  return "Не удалось записаться. Попробуйте ещё раз.";
}

export function EventDetailsView({ details, onBook, onCancel, onCheckIn, onBuy, onOpenPlace, onOpenChat, promo }: EventDetailsViewProps) {
  const { event, place, organizer, organization } = details;
  const paymentUrl = event.isPaid ? event.paymentUrl : null;
  const organizerName = organizer === null ? null : [organizer.firstName, organizer.lastName].filter(Boolean).join(" ");
  // The organization is who the visitor is actually dealing with; the user row behind it is an account.
  const organizationName = organization?.name ?? null;

  return (
    <article className="app-event">
      <div className={`app-card-media app-event-media app-media--${event.category}`}>
        {event.coverUrl ? <img alt="" className="app-card-media-img" src={event.coverUrl} /> : null}
        <div className="app-event-media-overlay">
          <AppTitle asChild>
            <h1 className="app-event-title">{event.title}</h1>
          </AppTitle>
          <p className="app-event-media-meta">
            {formatStartsAt(event.startsAt)} · {CATEGORY_LABELS[event.category]}
            {event.promoted && " · Промо"}
          </p>
        </div>
      </div>
      <div className="app-event-body">
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
          {event.weather && (
            <div className="app-event-meta-row">
              <dt>Погода</dt>
              <dd>{formatEventWeatherDetail(event.weather)}</dd>
            </div>
          )}
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
            <dd>{organizationName ?? organizerName ?? "Организатор не указан"}</dd>
          </div>
          {organization?.contacts && (
            <div className="app-event-meta-row">
              <dt>Связаться</dt>
              <dd>{organization.contacts}</dd>
            </div>
          )}
          {details.remainingSeats !== null && (
            <div className="app-event-meta-row">
              <dt>Свободные места</dt>
              <dd>Осталось {details.remainingSeats}</dd>
            </div>
          )}
        </dl>
        {event.description !== "" && <p className="app-event-description">{event.description}</p>}
        <div className="app-event-actions">
          {promo !== undefined && details.activeBookingId === null && details.remainingSeats !== 0 && (
            <div className="app-promo-code">
              {event.bookingOpensAt !== null && new Date(event.bookingOpensAt).getTime() > Date.now() && <AppText>Запись откроется {formatStartsAt(event.bookingOpensAt)}</AppText>}
              <input className="app-filters-input" type="text" value={promo.code} aria-label="Промокод" placeholder="Промокод (если есть)" onChange={(change) => promo.onCode(change.target.value)} />
              <input className="app-filters-input" type="text" value={promo.referral} aria-label="Код акции или друга" placeholder="Код акции или друга (если есть)" onChange={(change) => promo.onReferral(change.target.value)} />
              {promo.error !== null && <AppState error>{promo.error}</AppState>}
            </div>
          )}
          <BookingCta details={details} onBook={onBook} onCancel={onCancel} />
          {event.chatLink !== null && event.chatLink !== "" && (
            <AppButton onClick={() => onOpenChat(event.chatLink!)} tone="secondary" stretched>
              Открыть чат
            </AppButton>
          )}
          <div className="app-event-actions-row">
            <CheckInCta checkedIn={details.checkInId !== null} onCheckIn={onCheckIn} />
            {paymentUrl !== null && (
              <AppButton onClick={() => onBuy(paymentUrl)} tone="secondary">
                Купить билет
              </AppButton>
            )}
          </div>
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

/** Already named by the summary line above the list, so the list below covers the rest. */
const SUMMARISED_STATUSES: ParticipationStatus[] = ["going", "looking_for_company"];

/**
 * The matchmaking line the README promises: how many go, how many people you know reacted at all, how
 * many are looking for company. Zeros are part of the answer — hiding them read as "we have no idea"
 * instead of "nobody yet".
 *
 * «знакомых отметились», not «друзей идут»: friendsCount counts friends with a participation of any
 * status (participations.service.ts), so between two going/looking clauses the shorter wording would
 * claim a number the backend never measured — and produce «1 идёт · 7 друзей» on the demo event.
 */
export function participationSummary(stats: ParticipationStats): string {
  const going = stats.counts.going;
  const friends = stats.friendsCount;
  const looking = stats.counts.looking_for_company;
  return [`${going} ${pluralRu(going, "идёт", "идут", "идут")}`, `${friends} ${pluralRu(friends, "знакомый", "знакомых", "знакомых")} ${pluralRu(friends, "отметился", "отметились", "отметились")}`, `${looking} ${pluralRu(looking, "ищет", "ищут", "ищут")} компанию`].join(" · ");
}

interface ParticipationViewProps {
  stats: ParticipationStats;
  onSet: (status: ParticipationStatus) => void;
  onClear: () => void;
}

export function ParticipationView({ stats, onSet, onClear }: ParticipationViewProps) {
  // An empty list still drew its top border and padding: a divider with nothing under it.
  const listed = PARTICIPATION_STATUSES.filter((status) => !SUMMARISED_STATUSES.includes(status) && stats.counts[status] > 0);
  return (
    <section className="app-event">
      <div className="app-event-body">
        <AppTitle asChild>
          <h2 className="app-section-title">Твой статус</h2>
        </AppTitle>
        <select
          className="app-filters-input app-participation-select"
          aria-label="Твой статус участия"
          value={stats.myStatus ?? ""}
          onChange={(change) => {
            const value = change.target.value;
            if (value === "") onClear();
            else onSet(value as ParticipationStatus);
          }}
        >
          <option value="">Не выбран</option>
          {PARTICIPATION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {PARTICIPATION_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        <p className="app-participation-summary">{participationSummary(stats)}</p>
        {listed.length > 0 && (
          <ul className="app-participation-counters">
            {listed.map((status) => (
              <li key={status}>
                {PARTICIPATION_COUNTER_LABELS[status]}: {stats.counts[status]}
              </li>
            ))}
          </ul>
        )}
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
    return (
      <AppState error={failed} action={failed ? { label: "Повторить", onClick: load } : undefined}>
        {failed ? "Не удалось загрузить статусы." : "Загрузка…"}
      </AppState>
    );
  }
  return <ParticipationView stats={stats} onSet={setStatus} onClear={clear} />;
}

export function AutoPlanEntry({ activeBookingId, eventId }: { activeBookingId: string | null; eventId: string }) {
  if (activeBookingId === null) return null;
  return <AutoPlanSection eventId={eventId} />;
}

export function EventPage({ id }: { id: string }) {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const { navigate } = useRoute();
  const [state, refetch] = useEventDetails(id, userId);

  // Fire-and-forget page view (#196): a tracking failure must never break the page (trackPageView swallows rejections); skip until auth resolves so pre-login views are not recorded.
  useEffect(() => {
    if (userId === null) return;
    trackPageView({ targetType: "event", targetId: id });
  }, [id, userId]);

  const [promoCode, setPromoCode] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [payment, setPayment] = useState<{ bookingId: string; value: Payment | null } | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  // bookingId of the failed pay attempt — the error dies with its booking (cancel/re-book resets it)
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const activeBookingId = state.status === "ready" ? state.details.activeBookingId : null;
  const paidEvent = state.status === "ready" && state.details.event.isPaid;

  const loadPayment = useCallback((bookingId: string, reportError: boolean) => {
    setPaymentBusy(true);
    apiClient
      .payBooking(bookingId)
      .then(
        (booking) => {
          setPayment({ bookingId, value: booking.payment });
          setPaymentError(null);
        },
        () => {
          setPayment((prev) => (prev === null ? { bookingId, value: null } : prev));
          if (reportError) setPaymentError(bookingId);
        },
      )
      .finally(() => setPaymentBusy(false));
  }, []);

  // The details aggregate carries no payment: POST /bookings/:id/payment (ensurePayment) is the only read path; the failure stays silent so the external paymentUrl flow (provider=none) is untouched.
  useEffect(() => {
    if (activeBookingId === null || !paidEvent) return;
    if (payment !== null && payment.bookingId === activeBookingId) return;
    loadPayment(activeBookingId, false);
  }, [activeBookingId, paidEvent, payment, loadPayment]);

  const book = useCallback(() => {
    if (userId === null) return;
    const code = promoCode.trim();
    const referral = referralCode.trim();
    setBookingError(null);
    apiClient.createBooking({ userId, eventId: id, ...(code === "" ? {} : { promoCode: code }), ...(referral === "" ? {} : { referralCode: referral }) }).then(
      (booking) => {
        setPromoCode("");
        setReferralCode("");
        setPayment({ bookingId: booking.id, value: booking.payment });
        refetch();
      },
      (error: unknown) => {
        setBookingError(bookingErrorMessage(error, code !== ""));
        refetch();
      },
    );
  }, [userId, id, promoCode, referralCode, refetch]);

  const cancel = useCallback(() => {
    if (state.status !== "ready" || state.details.activeBookingId === null) return;
    apiClient.cancelBooking(state.details.activeBookingId).then(refetch, refetch);
  }, [state, refetch]);

  const pay = useCallback(() => {
    if (activeBookingId === null || paymentBusy) return;
    loadPayment(activeBookingId, true);
  }, [activeBookingId, paymentBusy, loadPayment]);

  const checkIn = useCallback(() => {
    if (userId === null) return;
    apiClient.createCheckIn({ userId, eventId: id }).then(refetch, refetch);
  }, [userId, id, refetch]);

  if (state.status === "loading" || userId === null) return <AppState>Загрузка…</AppState>;
  if (state.status === "error") return <AppState error>Не удалось загрузить событие.</AppState>;
  const currentPayment = payment !== null && payment.bookingId === state.details.activeBookingId ? payment.value : null;
  return (
    <>
      <EventDetailsView
        details={state.details}
        onBook={book}
        onCancel={cancel}
        onCheckIn={checkIn}
        onBuy={openExternalLink}
        onOpenChat={openChatLink}
        onOpenPlace={(placeId) => navigate({ name: "place", id: placeId })}
        promo={{
          code: promoCode,
          referral: referralCode,
          error: bookingError,
          onCode: (value) => {
            setPromoCode(value);
            setBookingError(null);
          },
          onReferral: (value) => {
            setReferralCode(value);
            setBookingError(null);
          },
        }}
      />
      <EventOrganizerRatingCard eventId={id} />
      {state.details.organizer !== null && (
        <section className="app-event">
          <div className="app-event-body">
            <SubscribeToggle target={{ type: "organizer", organizerUserId: state.details.organizer.id }} subscribeLabel="Подписаться на организатора" unsubscribeLabel="Отписаться от организатора" />
          </div>
        </section>
      )}
      <PaymentSection payment={currentPayment} busy={paymentBusy} error={paymentError !== null && paymentError === state.details.activeBookingId} onPay={pay} />
      <AutoPlanEntry activeBookingId={state.details.activeBookingId} eventId={id} />
      {state.details.remainingSeats === 0 && state.details.activeBookingId === null && <WaitlistSection eventId={id} userId={userId} onChanged={refetch} />}
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
      <ReportButton target={{ eventId: id }} userId={userId} />
    </>
  );
}
