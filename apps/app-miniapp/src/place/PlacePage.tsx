// START_MODULE_CONTRACT
// PURPOSE: Экран 34 «Место»: the venue as a social object — gradient hero with the daily check-in, the follow row, the three counters, friends who have been here, «Когда людно», the personal visit grid, the bookable windows and «Здесь скоро».
// SCOPE: Reads apiClient.getPlace/getPlacePage (the social aggregate) and apiClient.getPlaceBoard (everything the design needs that the place domain has no field for), writes apiClient.createCheckIn and the follow. Navigation only outwards: an event card, the slot booking screen, the follows screen. Empty data per block, not a page error.
// DEPENDS: ../api/client.js (apiClient, PlaceBoard, PlaceSlot), ../auth/AuthContext.js, ../catalog/format.js (pluralRu), ../organizer/OrganizerPage.js (PLACE_CATEGORY_LABELS), ../subscriptions/SubscribeToggle.js (matchesSubscriptionTarget), ./slots.js, ../routing/router.js, ../ui/icons.js, ../ui/primitives.js, @max-events/api-contracts (Place, PlaceFriendVisit, PlacePage), ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - friendVisitLabel - ru line per friend visit («была здесь 3 раза» / «идёт сегодня»)
// - placeKindLabel - «Парк · открыт до 23:00» — the chip over the title
// - occupancyLabel - «Сейчас свободно» / «Сейчас людно» from the bar of the current hour
// - occupancyAxis - the five hour marks under the bars, evenly spread over the published hours
// - visitMonthLabel - «май» — the month of a visit cell
// - slotPriceLine - «800 ₽/час · бесплатная отмена до 12:00» under the windows
// - upcomingLine - «Анна, Дима и ещё 5 · ты записан» / «11 из 40 · бесплатно» under an upcoming event
// - placeRatingValue - «4,8» or «—» when nobody has reviewed the place
// - placeRatingLabel - «1 240 оценок» or «оценок пока нет»
// - PlaceFollowRow - the follow control of the design: a wide toggle plus the entry to «Все подписки»
// - PlacePageState - union of place screen fetch states (loading / error / ready)
// - PlacePageView - presentational: the hero and the seven blocks of экран 34 with their empty states
// - PlacePage - route container: loads the aggregates, checks in, opens events, the windows and the follows
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import type { CreateSubscription, Place, PlaceFriendVisit, PlacePage as PlacePageAggregate } from "@max-events/api-contracts";
import { apiClient, trackPageView, whenEndpointMissing, type PlaceBoard, type PlaceSlot, type PlaceUpcomingEvent } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { pluralRu } from "../catalog/format";
import { PLACE_CATEGORY_LABELS } from "../organizer/OrganizerPage";
import { matchesSubscriptionTarget } from "../subscriptions/SubscribeToggle";
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { AppMedia, AppSkeletonList, AppState } from "../ui/primitives";
import { formatRub, formatSlotWindow, formatTime, formatUpcomingWhen, slotStatusLabel } from "./slots";

/** Friend line: «Анна была здесь 3 раза» / «Дима идёт сегодня»; the going-today line wins when both apply. */
export function friendVisitLabel(visit: PlaceFriendVisit): string {
  const name = visit.friend.name.split(" ")[0];
  if (visit.goingToday) return `${name} идёт сегодня`;
  // ponytail: gender heuristic for demo fixtures; male names on -а/-я (Дима, Никита, Илья) are listed as exceptions — per-friend gender arrives with the profile contract
  const maleExceptions = ["дима", "никита", "илья"];
  const lowerName = name.toLowerCase();
  const isFemale = /[ая]$/.test(lowerName) && !maleExceptions.includes(lowerName);
  const gendered = isFemale ? "была здесь" : "был здесь";
  return `${name} ${gendered} ${visit.visitsCount} ${pluralRu(visit.visitsCount, "раз", "раза", "раз")}`;
}

/** «Парк · открыт до 23:00»; a venue that publishes no hours says only what it is. */
export function placeKindLabel(place: Pick<Place, "category">, openUntil: string | null): string {
  const kind = PLACE_CATEGORY_LABELS[place.category];
  return openUntil === null ? kind : `${kind} · открыт до ${openUntil}`;
}

/** The right side of the «Когда людно» heading: what the bar of the current hour says about right now. */
export function occupancyLabel(board: Pick<PlaceBoard, "occupancy" | "occupancyNowHour">): string | null {
  const now = board.occupancy.find((hour) => hour.hour === board.occupancyNowHour);
  if (now === undefined) return null;
  if (now.load >= 0.75) return "Сейчас людно";
  return now.load >= 0.45 ? "Сейчас оживлённо" : "Сейчас свободно";
}

/** Five marks under the bars: the first hour, the last, and three evenly between — the axis of the design. */
export function occupancyAxis(board: Pick<PlaceBoard, "occupancy">): number[] {
  const hours = board.occupancy.map((bar) => bar.hour);
  if (hours.length === 0) return [];
  const marks: number[] = [];
  for (let index = 0; index < 5; index += 1) marks.push(hours[Math.round((index * (hours.length - 1)) / 4)]);
  return [...new Set(marks)];
}

/** «май», «июн», «сен» — three letters, because a cell of the grid is as wide as a quarter of the screen. */
export function visitMonthLabel(month: string): string {
  return new Date(`${month}-01T12:00:00+03:00`).toLocaleDateString("ru-RU", { month: "short" }).replace(".", "").slice(0, 3);
}

/** «800 ₽/час · бесплатная отмена до 12:00»; either half may be missing, and then it is simply not printed. */
export function slotPriceLine(board: Pick<PlaceBoard, "pricePerHourRub" | "cancelBefore">): string | null {
  const parts: string[] = [];
  if (board.pricePerHourRub !== null) parts.push(`${board.pricePerHourRub.toLocaleString("ru-RU")} ₽/час`);
  if (board.cancelBefore !== null) parts.push(`бесплатная отмена до ${formatTime(board.cancelBefore)}`);
  return parts.length === 0 ? null : parts.join(" · ");
}

/**
 * The line under an upcoming event. With friends going it names them, the way the design does;
 * without friends it falls back to the counter, which is the only thing the event itself knows.
 */
export function upcomingLine(card: PlaceUpcomingEvent): string {
  const parts: string[] = [];
  if (card.friends.length > 0) {
    const names = card.friends.map((friend) => friend.name.split(" ")[0]);
    const rest = card.friendsCount - names.length;
    parts.push(rest > 0 ? `${names.join(", ")} и ещё ${rest}` : names.join(", "));
  } else if (card.event.capacity !== null) {
    parts.push(`${card.goingCount} из ${card.event.capacity}`);
  } else if (card.goingCount > 0) {
    parts.push(`${card.goingCount} ${pluralRu(card.goingCount, "человек", "человека", "человек")}`);
  }
  if (card.joined) parts.push("ты записан");
  else if (!card.event.isPaid) parts.push("бесплатно");
  else if (card.event.priceRub !== null) parts.push(formatRub(card.event.priceRub));
  return parts.join(" · ");
}

type FollowState = { status: "loading" } | { status: "failed" } | { status: "ready"; subscriptionId: string | null };

/**
 * The follow row of the design: a wide toggle and the entry to the follows screen next to it. The
 * matching of a stored follow against this venue is the shared helper of the subscriptions module —
 * only the skin is local, because this row is the design's, not the generic button's.
 */
export function PlaceFollowRow({ placeId, onOpenSubscriptions }: { placeId: string; onOpenSubscriptions: () => void }) {
  const [state, setState] = useState<FollowState>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const target: CreateSubscription = { type: "place", placeId };

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    apiClient.listSubscriptions().then(
      (rows) => {
        if (alive) setState({ status: "ready", subscriptionId: rows.find((row) => matchesSubscriptionTarget(row, { type: "place", placeId }))?.id ?? null });
      },
      () => {
        if (alive) setState({ status: "failed" });
      },
    );
    return () => {
      alive = false;
    };
  }, [placeId]);

  const toggle = useCallback(() => {
    if (state.status !== "ready" || busy) return;
    setBusy(true);
    const current = state.subscriptionId;
    const action = current === null ? apiClient.createSubscription(target).then((row) => row.id) : apiClient.removeSubscription(current).then(() => null);
    action.then(
      (subscriptionId) => {
        setState({ status: "ready", subscriptionId });
        setBusy(false);
      },
      () => {
        setBusy(false);
      },
    );
    // target is rebuilt every render, so the id is what the callback really depends on
  }, [state, busy, placeId]);

  // Until the follows are known the label would be a guess, and a button that flips under the finger is worse than one that waits.
  const followed = state.status === "ready" && state.subscriptionId !== null;
  const label = state.status === "loading" ? "Проверяем подписку…" : state.status === "failed" ? "Подписка недоступна" : followed ? "Вы подписаны на место" : "Подписаться на место";
  return (
    <div className="app-place-follow">
      <button type="button" className="app-place-follow-toggle" aria-pressed={followed} disabled={state.status !== "ready" || busy} onClick={toggle}>
        <ActionIcon name={followed ? "check" : "plus"} size={18} strokeWidth={2.4} />
        {label}
      </button>
      <button type="button" className="app-place-follow-all" onClick={onOpenSubscriptions}>
        Все подписки
      </button>
    </div>
  );
}

export type PlacePageState = { status: "loading" } | { status: "error" } | { status: "ready"; place: Place; page: PlacePageAggregate; board: PlaceBoard | null };

interface PlacePageViewProps {
  place: Place;
  page: PlacePageAggregate;
  /** Everything the place domain has no field for; null when the backend answers no such aggregate, and then those blocks are simply not on the screen. */
  board: PlaceBoard | null;
  checkedIn: boolean;
  onBack: () => void;
  onCheckIn: () => void;
  onOpenEvent: (eventId: string) => void;
  onOpenSlots: () => void;
  onOpenSubscriptions: () => void;
  onCreateHere: () => void;
  onSave: () => void;
}

function SlotRow({ slot, onOpen }: { slot: PlaceSlot; onOpen: () => void }) {
  const status = slotStatusLabel(slot);
  return (
    <button type="button" className="app-place-slot" onClick={onOpen} disabled={!status.free}>
      <ActionIcon name="clock" size={20} strokeWidth={2} />
      <span className="app-place-slot-window">{formatSlotWindow(slot)}</span>
      <span className={status.free ? "app-place-slot-status app-place-slot-status--free" : "app-place-slot-status"}>
        {status.free && <span className="app-place-slot-dot" aria-hidden="true" />}
        {status.label}
      </span>
    </button>
  );
}

/** A summary with zero reviews is not a score of 0,0 — there is nothing to average yet. */
export function placeRatingValue(rating: { averageStars: number; reviewsCount: number } | null): string {
  if (rating === null || rating.reviewsCount === 0) return "—";
  return rating.averageStars.toLocaleString("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function placeRatingLabel(rating: { reviewsCount: number } | null): string {
  if (rating === null || rating.reviewsCount === 0) return "оценок пока нет";
  return `${rating.reviewsCount.toLocaleString("ru-RU")} ${pluralRu(rating.reviewsCount, "оценка", "оценки", "оценок")}`;
}

export function PlacePageView({ place, page, board, checkedIn, onBack, onCheckIn, onOpenEvent, onOpenSlots, onOpenSubscriptions, onCreateHere, onSave }: PlacePageViewProps) {
  const alreadyHere = checkedIn || (board?.checkedInToday ?? false);
  const rating = page.rating?.summary ?? null;
  const occupancy = board === null ? null : occupancyLabel(board);
  const priceLine = board === null ? null : slotPriceLine(board);
  return (
    <section className="app-place">
      <div className="app-place-hero">
        <span className="app-place-blob" aria-hidden="true" />
        <span className="app-place-blob app-place-blob--cyan" aria-hidden="true" />
        <button type="button" className="app-place-back" aria-label="Назад" onClick={onBack}>
          <ActionIcon name="chevron" size={18} strokeWidth={2.4} />
          Назад
        </button>
        <div className="app-place-hero-veil">
          <span className="app-place-kind">{placeKindLabel(place, board?.openUntil ?? null)}</span>
          <h1 className="app-place-title">{place.title}</h1>
          <div className="app-place-hero-actions">
            <button type="button" className="app-place-checkin" disabled={alreadyHere} onClick={onCheckIn}>
              <ActionIcon name="pin" size={18} strokeWidth={2.4} />Я здесь
            </button>
            {alreadyHere && (
              <span className="app-place-checked">
                <ActionIcon name="check" size={16} strokeWidth={2.6} />
                Сегодня уже отмечен
              </span>
            )}
            <button type="button" className="app-place-create" aria-label="Создать событие здесь" onClick={onCreateHere}>
              <ActionIcon name="plus" size={18} strokeWidth={2.4} />
              Создать
            </button>
          </div>
          <p className="app-place-hero-hint">Место можно отмечать раз в сутки, событие — один раз</p>
        </div>
      </div>

      <PlaceFollowRow placeId={place.id} onOpenSubscriptions={onOpenSubscriptions} />

      <div className="app-place-stats">
        <div className="app-place-stat">
          <span className="app-place-stat-value">{placeRatingValue(rating)}</span>
          <span className="app-place-stat-label">{placeRatingLabel(rating)}</span>
        </div>
        {page.personalVisitsCount > 0 && (
          <div className="app-place-stat">
            <span className="app-place-stat-value">{page.personalVisitsCount}</span>
            <span className="app-place-stat-label">твоих визитов</span>
          </div>
        )}
        {/* Ноль — не ответ: пустую неделю и нулевые визиты закрывает текст блоков ниже. */}
        {board !== null && board.weekEventsCount > 0 && (
          <div className="app-place-stat">
            <span className="app-place-stat-value">{board.weekEventsCount}</span>
            <span className="app-place-stat-label">{pluralRu(board.weekEventsCount, "событие", "события", "событий")} на неделе</span>
          </div>
        )}
      </div>

      <section className="app-place-block" aria-label="Друзья здесь бывали">
        <div className="app-place-block-head">
          <h2 className="app-place-block-title">Друзья здесь бывали</h2>
          {page.friends.length > 0 && (
            <span className="app-place-block-note">
              {page.friends.length} {pluralRu(page.friends.length, "человек", "человека", "человек")}
            </span>
          )}
        </div>
        {page.friends.length === 0 ? (
          <AppState>Друзья пока не отмечались здесь.</AppState>
        ) : (
          <div className="app-place-friends">
            <span className="app-place-faces" role="img" aria-label={page.friends.map((visit) => visit.friend.name).join(", ")}>
              {page.friends.slice(0, 3).map((visit) => (
                <span key={visit.friend.id} className="app-place-face">
                  {visit.friend.name.charAt(0)}
                </span>
              ))}
            </span>
            <span className="app-place-friends-lines">
              <b className="app-place-friends-lead">{friendVisitLabel(page.friends[0])}</b>
              {page.popularityToday > 0 && (
                <span className="app-place-friends-note">
                  {page.popularityToday} {pluralRu(page.popularityToday, "человек", "человека", "человек")} {pluralRu(page.popularityToday, "был", "были", "были")} здесь сегодня
                </span>
              )}
            </span>
          </div>
        )}
      </section>

      {board !== null && (
        <section className="app-place-block" aria-label="Когда людно">
          <div className="app-place-block-head">
            <h2 className="app-place-block-title">Когда людно</h2>
            {occupancy !== null && (
              <span className="app-place-now">
                <span className="app-place-now-dot" aria-hidden="true" />
                {occupancy}
              </span>
            )}
          </div>
          {board.occupancy.length === 0 ? (
            <AppState>Пока не из чего считать загруженность.</AppState>
          ) : (
            <>
              <div className="app-place-bars" role="img" aria-label={`Загруженность с ${board.occupancy[0].hour}:00 до ${board.occupancy[board.occupancy.length - 1].hour}:00`}>
                {board.occupancy.map((bar) => (
                  <span key={bar.hour} className={bar.hour === board.occupancyNowHour ? "app-place-bar app-place-bar--now" : "app-place-bar"} style={{ height: `${Math.round(bar.load * 100)}%` }} />
                ))}
              </div>
              <div className="app-place-axis" aria-hidden="true">
                {occupancyAxis(board).map((hour) => (
                  <span key={hour}>{hour}</span>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {board !== null && (
        <section className="app-place-block" aria-label="Твоя история здесь">
          <h2 className="app-place-block-title">Твоя история здесь</h2>
          {board.visitMonths.length === 0 ? (
            <AppState>Ты ещё не отмечался здесь — отметься, и здесь появится история.</AppState>
          ) : (
            <div className="app-place-months">
              {board.visitMonths.map((month) => (
                <span key={month.month} className="app-place-month" title={`${month.visitsCount} ${pluralRu(month.visitsCount, "визит", "визита", "визитов")}`}>
                  <span className="app-place-month-label">{visitMonthLabel(month.month)}</span>
                </span>
              ))}
              {board.visitMonthsMore > 0 && <span className="app-place-month app-place-month--more">+{board.visitMonthsMore}</span>}
            </div>
          )}
        </section>
      )}

      {board !== null && board.unitTitle !== null && (
        <section className="app-place-block" aria-label="Доступные слоты бронирования">
          <div className="app-place-label">
            <ActionIcon name="calendar" size={14} strokeWidth={2.2} />
            Доступные слоты бронирования
          </div>
          {board.slots.length === 0 ? (
            <AppState>Свободных окон сейчас нет.</AppState>
          ) : (
            <div className="app-place-slots">
              {board.slots.map((slot) => (
                <SlotRow key={slot.id} slot={slot} onOpen={onOpenSlots} />
              ))}
            </div>
          )}
          {priceLine !== null && <p className="app-place-slots-note">{priceLine}</p>}
        </section>
      )}

      {board !== null && (
        <section className="app-place-block" aria-label="Здесь скоро">
          <h2 className="app-place-block-title">Здесь скоро</h2>
          {board.upcoming.length === 0 ? (
            <AppState>Пока здесь ничего не запланировано.</AppState>
          ) : (
            <div className="app-place-upcoming">
              {board.upcoming.map((card) => (
                <button key={card.event.id} type="button" className="app-place-event" onClick={() => onOpenEvent(card.event.id)}>
                  <AppMedia category={card.event.category} className="app-place-event-media" />
                  <span className="app-place-event-body">
                    <span className="app-place-event-when">{formatUpcomingWhen(card.event.startsAt)}</span>
                    <span className="app-place-event-title">{card.event.title}</span>
                    <span className="app-place-event-line">{upcomingLine(card)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="app-place-cta">
        <button type="button" className="app-place-save" aria-label="Сохранить в список" onClick={onSave}>
          <ActionIcon name="bookmark" size={20} strokeWidth={2} />
        </button>
        <button type="button" className="app-place-plan" onClick={onOpenSlots}>
          Собрать план здесь
        </button>
      </div>
    </section>
  );
}

export function PlacePage({ id }: { id: string }) {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const { navigate, back } = useRoute();
  const [state, setState] = useState<PlacePageState>({ status: "loading" });
  // The check-in answers with the CheckIn, not with a fresh board, so the button state is kept here
  // until the next load; board.checkedInToday is what survives a remount.
  const [checkedIn, setCheckedIn] = useState(false);

  // Fire-and-forget page view (#196): a tracking failure must never break the page (trackPageView swallows rejections); skip until auth resolves so pre-login views are not recorded.
  useEffect(() => {
    if (userId === null) return;
    trackPageView({ targetType: "place", targetId: id });
  }, [id, userId]);

  useEffect(() => {
    if (userId === null) return;
    let alive = true;
    setState({ status: "loading" });
    setCheckedIn(false);
    // Площадка и её социальная сводка — сам экран; доски (часы, загруженность, окна) на бэкенде
    // нет вовсе (#492), и без неё экран открывается без этих блоков, а не вместо экрана.
    Promise.all([apiClient.getPlace(id), apiClient.getPlacePage(id, userId), apiClient.getPlaceBoard(id, userId).catch(whenEndpointMissing<PlaceBoard | null>(null))]).then(
      ([place, page, board]) => {
        if (alive) setState({ status: "ready", place, page, board });
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [id, userId]);

  if (state.status === "loading") return <AppSkeletonList rows={4} />;
  if (state.status === "error") return <AppState error>Не удалось загрузить место.</AppState>;
  const checkIn = () => {
    if (userId === null) return;
    apiClient.createCheckIn({ userId, placeId: id }).then(
      () => setCheckedIn(true),
      () => {},
    );
  };
  return <PlacePageView place={state.place} page={state.page} board={state.board} checkedIn={checkedIn} onBack={back} onCheckIn={checkIn} onOpenEvent={(eventId) => navigate({ name: "event", id: eventId })} onOpenSlots={() => navigate({ name: "slot-booking", placeId: id })} onOpenSubscriptions={() => navigate({ name: "subscriptions" })} onCreateHere={() => navigate({ name: "micro-new" })} onSave={() => navigate({ name: "lists" })} />;
}
