// START_MODULE_CONTRACT
// PURPOSE: Экран 17 «Карточка события» container: loads the aggregate, the hourly forecast, the walking route, the organizer rating, the company and the «Обстановка»/«Рядом» blocks, and hosts экран 18 «Запись и лист ожидания» as the sheet the booking CTA opens.
// SCOPE: Data via apiClient (mock or live); booking create/cancel with the promo code fields (#202/#372), in-app payment of the active booking (#213), the external payment link, the waitlist, the check-in, saving to a list, the event wall, the post-event review and the report; layout belongs to ./EventScreen.tsx and ./BookingSheet.tsx.
// DEPENDS: ../api/client.js (apiClient, trackPageView, BookingOffer, EventCompanions, EventDetails, EventForecast, EventMoodTag, EventNearbySpot, TravelOption), @max-events/api-contracts (OrganizerRating, ParticipationStatus, Payment, WaitlistEntry), ../auth/AuthContext.js, ../geo/viewer-origin.js, ../max/bridge.js (openChatLink, openExternalLink, shareResult, webApp), ../routing/router.js, ../subscriptions/SubscribeToggle.js, ../ui/primitives.js, ./EventScreen.js, ./BookingSheet.js, ./SaveToList.js, ./ReviewSection.js, ./ReportButton.js, ./WaitlistSection.js, ./PaymentSection.js, ../plans/AutoPlanSection.js, ../feed/FeedPage.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - EventDetailsState - union of details fetch states (loading / error / ready)
// - bookingErrorMessage - booking failure -> inline text: 403 = promo code rejected / early access needs a code, 409 = sold out (#202)
// - PromoCodeState - promo code fields of the booking sheet (discount code, referral/campaign code, inline error, onCode/onReferral) (#372)
// - eventShareText - what «Поделиться» puts in a MAX chat: the title and when it starts
// - organizerDisplayName - who the visitor is dealing with: the organization, else the organizer account, else a placeholder
// - walkingOption - the walking estimate of the travel answer, which is what the route card prints
// - PARTICIPATION_STATUS_LABELS - human-readable labels for the 6 participation statuses (shared with the friends feed)
// - EventExtras - what экран 17 carries past the design blocks: payment, autoplan, the waitlist status, the wall, the review, the check-in and the report
// - EventPage - route container: resolves the user id from the auth context, loads every block of экран 17, keeps the booking sheet of экран 18 and wires booking, payment, waitlist, check-in and sharing; records the page view fire-and-forget once auth resolved (#196)
// END_MODULE_MAP

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, apiClient, trackPageView, type BookingOffer, type EventCompanions, type EventDetails, type EventForecast, type EventMoodTag, type EventNearbySpot, type TravelOption } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { OrganizerRating, ParticipationStatus, Payment } from "@max-events/api-contracts";
import { browsedCityOrigin, useViewerOrigin } from "../geo/viewer-origin";
import { openChatLink, openExternalLink, shareResult, getWebApp } from "../max/bridge";
import { sharePayload } from "../max/links";
import { SubscribeToggle } from "../subscriptions/SubscribeToggle";
import { useRoute } from "../routing/router";
import { AppState } from "../ui/primitives";
import { SaveToList } from "./SaveToList";
import { FeedSection } from "../feed/FeedPage";
import { ReviewSection } from "./ReviewSection";
import { ReportButton } from "./ReportButton";
import { WaitlistSection } from "./WaitlistSection";
import { PaymentSection } from "./PaymentSection";
import { AutoPlanSection } from "../plans/AutoPlanSection";
import { BookingSheet } from "./BookingSheet";
import { EventBookingBar, EventForecastCard, EventHero, EventMoodTags, EventNearbyList, EventOrganizerCard, EventRouteCard, EventWhenRow, EventWhoGoesRow, formatDayLine, formatTimeRange } from "./EventScreen";

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

/** Promo code fields of the booking sheet (#202/#372). The backend keeps the discount promoCode and the referral/campaign referralCode apart (BookingsService.create parity). */
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

/** A shared event is a title and a time: the link back into the mini-app is the platform's job, not ours to fake. */
export function eventShareText(event: Pick<EventDetails["event"], "title" | "startsAt" | "endsAt">): string {
  return `${event.title} — ${formatDayLine(event.startsAt)}, ${formatTimeRange(event.startsAt, event.endsAt)}`;
}

/** The organization is who the visitor is actually dealing with; the user row behind it is an account. */
export function organizerDisplayName(details: Pick<EventDetails, "organizer" | "organization">): string {
  const person = details.organizer === null ? null : [details.organizer.firstName, details.organizer.lastName].filter(Boolean).join(" ");
  return details.organization?.name ?? (person !== null && person !== "" ? person : "Организатор не указан");
}

/** The route card is about walking to the door, so the metro estimate of the same answer is not its number. */
export function walkingOption(options: TravelOption[]): TravelOption | null {
  return options.find((option) => option.mode === "walk") ?? null;
}

export const PARTICIPATION_STATUS_LABELS: Record<ParticipationStatus, string> = {
  wants_to_go: "Хочу пойти",
  probably_going: "Скорее всего пойду",
  going: "Иду",
  looking_for_company: "Ищу компанию",
  looking_for_travel_buddy: "Ищу попутчика",
  looking_for_after_event_company: "Ищу, с кем продолжить после события",
};

interface EventExtrasProps {
  details: EventDetails;
  eventId: string;
  userId: string;
  payment: Payment | null;
  paymentBusy: boolean;
  paymentFailed: boolean;
  onPay: () => void;
  onCheckIn: () => void;
  onChanged: () => void;
  onCreatePost: () => void;
}

/**
 * Everything экран 17 carries that the макет has no row for and that shipping it would drop: the
 * in-app payment of an active booking (#213), the autoplan entry, the waitlist status with its
 * confirmation window (#260), the event wall, the post-event review (#144), the check-in and the
 * report (#167). They sit under the design blocks rather than between them, so the card reads in the
 * order the design gives it.
 */
export function EventExtras({ details, eventId, userId, payment, paymentBusy, paymentFailed, onPay, onCheckIn, onChanged, onCreatePost }: EventExtrasProps) {
  return (
    <div className="app-ev-extras">
      <PaymentSection payment={payment} busy={paymentBusy} error={paymentFailed} onPay={onPay} />
      {details.activeBookingId !== null && <AutoPlanSection eventId={eventId} />}
      {details.remainingSeats === 0 && details.activeBookingId === null && <WaitlistSection eventId={eventId} userId={userId} onChanged={onChanged} />}
      <div className="app-ev-secondary">
        <button type="button" className="app-ev-secondary-btn" disabled={details.checkInId !== null} onClick={onCheckIn}>
          {details.checkInId !== null ? "Вы были здесь" : "Я здесь"}
        </button>
      </div>
      <FeedSection eventId={eventId} onCreate={onCreatePost} />
      <ReviewSection eventId={eventId} userId={userId} canReview={details.activeBookingId !== null && new Date(details.event.startsAt).getTime() < Date.now()} />
      <ReportButton target={{ eventId }} userId={userId} />
    </div>
  );
}

export function EventPage({ id }: { id: string }) {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const { navigate, back } = useRoute();
  const [state, refetch] = useEventDetails(id, userId);
  const origin = useViewerOrigin();

  // Fire-and-forget page view (#196): a tracking failure must never break the page (trackPageView swallows rejections); skip until auth resolves so pre-login views are not recorded.
  useEffect(() => {
    if (userId === null) return;
    trackPageView({ targetType: "event", targetId: id });
  }, [id, userId]);

  const [forecast, setForecast] = useState<EventForecast | null>(null);
  const [moods, setMoods] = useState<EventMoodTag[]>([]);
  const [nearby, setNearby] = useState<EventNearbySpot[]>([]);
  const [companions, setCompanions] = useState<EventCompanions | null>(null);
  const [rating, setRating] = useState<OrganizerRating | null>(null);
  const [travel, setTravel] = useState<TravelOption | null>(null);
  const [offer, setOffer] = useState<BookingOffer | null>(null);
  const [queued, setQueued] = useState(false);

  // Every block of экран 17 fails on its own: a forecast that does not answer hides its card and
  // leaves the record, the address and the company where they are.
  useEffect(() => {
    if (userId === null) return;
    let alive = true;
    const keep =
      <T,>(apply: (value: T) => void) =>
      (value: T) => {
        if (alive) apply(value);
      };
    const ignore = () => {};
    apiClient.getEventForecast(id).then(keep(setForecast), ignore);
    apiClient.listEventMoodTags(id).then(keep(setMoods), ignore);
    apiClient.listEventNearby(id).then(keep(setNearby), ignore);
    apiClient.getEventCompanions(id, userId).then(keep(setCompanions), ignore);
    apiClient.getBookingOffer(id, userId).then(keep(setOffer), ignore);
    apiClient.getEventOrganizerRating(id).then(
      keep((response: { rating: OrganizerRating | null }) => setRating(response.rating)),
      ignore,
    );
    apiClient.getMyWaitlistEntry(id, userId).then(
      keep((entry) => setQueued(entry !== null)),
      ignore,
    );
    return () => {
      alive = false;
    };
  }, [id, userId]);

  const placeId = state.status === "ready" ? state.details.place?.id : undefined;
  const eventCity = state.status === "ready" ? state.details.event.city : "";
  // The route is inside the event's city. A GPS fix in another region is not the start of that walk.
  const travelPoint = useMemo(() => (eventCity === "" ? { latitude: origin.latitude, longitude: origin.longitude, fromViewer: true } : browsedCityOrigin(origin, eventCity)), [origin, eventCity]);
  useEffect(() => {
    if (placeId === undefined) return;
    let alive = true;
    apiClient.getTravelOptions(placeId, { latitude: travelPoint.latitude, longitude: travelPoint.longitude }).then(
      (options) => {
        if (alive) setTravel(walkingOption(options));
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [placeId, travelPoint.latitude, travelPoint.longitude]);

  const [promoCode, setPromoCode] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [payment, setPayment] = useState<{ bookingId: string; value: Payment | null } | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  // bookingId of the failed pay attempt — the error dies with its booking (cancel/re-book resets it)
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

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
    if (userId === null || state.status !== "ready") return;
    const paymentUrl = state.details.event.isPaid ? state.details.event.paymentUrl : null;
    const code = promoCode.trim();
    const referral = referralCode.trim();
    setBookingError(null);
    apiClient.createBooking({ userId, eventId: id, ...(code === "" ? {} : { promoCode: code }), ...(referral === "" ? {} : { referralCode: referral }) }).then(
      (booking) => {
        setPromoCode("");
        setReferralCode("");
        setPayment({ bookingId: booking.id, value: booking.payment });
        // The organizer takes the money on their own site (макет, экран 18): the record is ours, the checkout is theirs.
        if (paymentUrl !== null) openExternalLink(paymentUrl);
        refetch();
      },
      (error: unknown) => {
        setBookingError(bookingErrorMessage(error, code !== ""));
        refetch();
      },
    );
  }, [userId, id, state, promoCode, referralCode, refetch]);

  const cancel = useCallback(() => {
    if (state.status !== "ready" || state.details.activeBookingId === null) return;
    apiClient.cancelBooking(state.details.activeBookingId).then(refetch, refetch);
    setSheetOpen(false);
  }, [state, refetch]);

  const pay = useCallback(() => {
    if (activeBookingId === null || paymentBusy) return;
    loadPayment(activeBookingId, true);
  }, [activeBookingId, paymentBusy, loadPayment]);

  const checkIn = useCallback(() => {
    if (userId === null) return;
    apiClient.createCheckIn({ userId, eventId: id }).then(refetch, refetch);
  }, [userId, id, refetch]);

  const joinWaitlist = useCallback(() => {
    if (userId === null) return;
    apiClient.joinWaitlist(id, userId).then(
      () => {
        setQueued(true);
        setSheetOpen(false);
      },
      () => setQueued(false),
    );
  }, [id, userId]);

  const share = useCallback(() => {
    if (state.status !== "ready") return;
    const payload = sharePayload(eventShareText(state.details.event), `event-${state.details.event.id}`);
    void shareResult(getWebApp(), payload.text, payload.link);
  }, [state]);

  if (state.status === "loading" || userId === null) return <AppState>Загрузка…</AppState>;
  if (state.status === "error") return <AppState error>Не удалось загрузить событие.</AppState>;
  const { details } = state;
  const { event, place } = details;
  const currentPayment = payment !== null && payment.bookingId === details.activeBookingId ? payment.value : null;
  const organizerName = organizerDisplayName(details);
  const promo: PromoCodeState = {
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
  };

  return (
    <article className="app-ev">
      <EventHero details={details} saveOpen={saveOpen} onBack={back} onShare={share} onSave={() => setSaveOpen((open) => !open)} />
      <SaveToList eventId={id} userId={userId} open={saveOpen} onClose={() => setSaveOpen(false)} />
      <EventWhenRow event={event} />
      {forecast !== null && <EventForecastCard forecast={forecast} />}
      {place !== null && <EventRouteCard address={place.address} hint={place.title} travel={travel} fromCenter={!travelPoint.fromViewer} onRoute={() => navigate({ name: "place", id: place.id })} />}
      <EventOrganizerCard name={organizerName} eventsCount={details.organizerEventsCount ?? null} rating={rating} subscribe={details.organizer === null ? null : <SubscribeToggle target={{ type: "organizer", organizerUserId: details.organizer.id }} subscribeLabel="Подписаться" unsubscribeLabel="Отписаться" />} />
      {companions !== null && <EventWhoGoesRow companions={companions} onOpen={() => navigate({ name: "companions", eventId: id })} />}
      {event.description !== "" && (
        <section className="app-ev-section" aria-label="О событии">
          <h2 className="app-ev-section-title">О событии</h2>
          <p className="app-ev-about">{event.description}</p>
        </section>
      )}
      <EventMoodTags tags={moods} />
      <EventNearbyList spots={nearby} onOpen={(spotId) => navigate({ name: "place", id: spotId })} />
      <EventExtras details={details} eventId={id} userId={userId} payment={currentPayment} paymentBusy={paymentBusy} paymentFailed={paymentError !== null && paymentError === details.activeBookingId} onPay={pay} onCheckIn={checkIn} onChanged={refetch} onCreatePost={() => navigate({ name: "feed-new", eventId: id })} />
      <EventBookingBar details={details} chatLink={event.chatLink} onChat={() => event.chatLink !== null && openChatLink(event.chatLink)} onBook={() => setSheetOpen(true)} />
      {sheetOpen && <BookingSheet details={details} offer={offer} organizerName={organizerName} promo={promo} waitlist={details.remainingSeats === 0 && details.activeBookingId === null ? { ahead: offer?.waitlistAhead ?? 0, joined: queued, onJoin: joinWaitlist } : null} onClose={() => setSheetOpen(false)} onBook={book} onCancel={cancel} />}
    </article>
  );
}
