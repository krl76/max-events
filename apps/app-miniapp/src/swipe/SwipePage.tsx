// START_MODULE_CONTRACT
// PURPOSE: Экран 09 «Подбор мест свайпами»: the card deck of venues, the right/left swipe with its buttons and the category chips over it.
// SCOPE: The deck comes from apiClient.listSwipeCandidates and every decision goes back through apiClient.saveSwipeDecision; the drag itself is ../ui/gestures.js and the deck never refetches mid-session, so a card cannot jump under the finger. The venue page (экран 34) is where «Подробнее» leads.
// DEPENDS: ../api/client.js (apiClient, SwipeCandidate, SwipeCategory, SwipeDecision), ../catalog/format.js (pluralRu), ../geo/viewer-origin.js, ../routing/router.js, ../ui/gestures.js, ../ui/icons.js, ../ui/primitives.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - SwipeState - union of the deck fetch states (loading / error / ready)
// - SWIPE_COMMIT_PX - how far a card travels before the drag counts as a decision
// - SWIPE_CATEGORY_LABELS - ru label per filter chip of the design
// - swipeOutcome - drag distance -> decision; null while the card has not travelled far enough
// - swipeProgress - drag distance -> progress of the verdict from -1 (committed skip) to 1 (committed like), clamped; drives the tint over the card through --app-swipe-progress
// - SwipeLeaving - the card that has just been decided and is flying off: the candidate, the verdict and the dx it was released at
// - formatSwipeDistance - «2,4 км»; null when the candidate carries no distance (#496)
// - formatSwipeRating - «4.9 · 143 отзыва»; null until the venue is rated (#496)
// - formatSwipePrice - «800 ₽/час»; null until the slot domain answers a price (#492)
// - swipeFriendsLine - «Анна и Дима были здесь»; null when no friend has
// - swipeMatchLine - «92% совпадение с тобой»; null until something scores a venue against a person (#498)
// - SwipeCard - one venue card: the photo placeholder, the stamp, the facts, the friends and «Подробнее»; leaving plays the fly-out towards the verdict and reports its own animationend through onLeft
// - SwipeView - presentational: header, chips, the deck with its two shadow cards, the top card keyed by venue (so the next one rises on mount), the leaving card flying over it, and the action row
// - SwipePage - container: deck fetch per category, the drag, decisions, the leaving card until its fly-out ends, undo and navigation
// END_MODULE_MAP

import { useCallback, useEffect, useMemo, useRef, useState, type AnimationEvent as ReactAnimationEvent, type CSSProperties } from "react";
import { apiClient, SWIPE_CATEGORIES, type SwipeCandidate, type SwipeCategory, type SwipeDecision } from "../api/client";
import { pluralRu } from "../catalog/format";
import { browsedCityOrigin, useViewerOrigin } from "../geo/viewer-origin";
import { useRoute } from "../routing/router";
import { useSwipeDrag, type SwipeGestureProps } from "../ui/gestures";
import { ActionIcon } from "../ui/icons";
import { pictured } from "../ui/photos";
import { AppSkeleton, AppState } from "../ui/primitives";

export type SwipeState = { status: "loading" } | { status: "error" } | { status: "ready"; candidates: SwipeCandidate[] };

/** A third of a narrow phone: far enough that a scroll cannot be mistaken for a verdict. */
export const SWIPE_COMMIT_PX = 96;

export const SWIPE_CATEGORY_LABELS: Record<SwipeCategory, string> = {
  all: "Все",
  food: "Еда",
  outdoors: "На природе",
  sport: "Спорт",
};

/** Right saves, left passes, and a card that barely moved decides nothing. */
export function swipeOutcome(dx: number, threshold: number = SWIPE_COMMIT_PX): SwipeDecision | null {
  if (dx >= threshold) return "like";
  if (dx <= -threshold) return "skip";
  return null;
}

/** How far the verdict has come: -1 is a committed skip, 1 a committed like, 0 a card at rest. Saturates exactly where swipeOutcome decides. */
export function swipeProgress(dx: number, threshold: number = SWIPE_COMMIT_PX): number {
  return Math.max(-1, Math.min(1, dx / threshold));
}

export interface SwipeLeaving {
  candidate: SwipeCandidate;
  decision: SwipeDecision;
  /** Where the card was when the verdict landed, so the fly-out continues from under the finger rather than from the centre. */
  dx: number;
}

/** «2,4 км» — ru decimal comma, one digit; null while the list DTO carries no distance (#496). */
export function formatSwipeDistance(distanceKm: number | null): string | null {
  if (distanceKm === null) return null;
  if (distanceKm > 80) return "далеко";
  return `${distanceKm.toLocaleString("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} км`;
}

/** «4.9 · 143 отзыва», or the stars alone when the count is missing; null until the venue is rated (#496). */
export function formatSwipeRating(rating: number | null, reviewsCount: number | null): string | null {
  if (rating === null) return null;
  const stars = rating.toFixed(1);
  return reviewsCount === null ? stars : `${stars} · ${reviewsCount} ${pluralRu(reviewsCount, "отзыв", "отзыва", "отзывов")}`;
}

/** «800 ₽/час»; null until the slot domain answers a price (#492). */
export function formatSwipePrice(pricePerHourRub: number | null): string | null {
  return pricePerHourRub === null ? null : `${pricePerHourRub.toLocaleString("ru-RU")} ₽/час`;
}

/**
 * «Анна и Дима были здесь»: two names by name, more of them counted. A single name takes the colon
 * form, because Russian has no gender-neutral past tense and the friend carries no gender to agree with.
 */
export function swipeFriendsLine(friends: SwipeCandidate["friendsHere"]): string | null {
  const names = friends.map((friend) => friend.name.split(" ")[0]);
  if (names.length === 0) return null;
  if (names.length === 1) return `Были здесь: ${names[0]}`;
  if (names.length === 2) return `${names[0]} и ${names[1]} были здесь`;
  return `${names[0]}, ${names[1]} и ещё ${names.length - 2} были здесь`;
}

/** «92% совпадение с тобой»; null because nothing scores a venue against a person yet (#498). */
export function swipeMatchLine(matchPercent: number | null): string | null {
  return matchPercent === null ? null : `${matchPercent}% совпадение с тобой`;
}

interface SwipeCardProps {
  candidate: SwipeCandidate;
  dx: number;
  /** Карточку отпустили, не дотянув до порога: возврат домой едет анимацией, а не прыжком. */
  settling?: boolean;
  /** Вердикт, с которым карточка улетает; null у карточки, которая ещё в игре. */
  leaving?: SwipeDecision | null;
  gesture?: SwipeGestureProps;
  onOpen: () => void;
  /** Улёт закончился — карточку можно снимать с экрана. */
  onLeft?: () => void;
}

export function SwipeCard({ candidate, dx, settling = false, leaving = null, gesture, onOpen, onLeft }: SwipeCardProps) {
  const distance = formatSwipeDistance(candidate.distanceKm);
  const rating = formatSwipeRating(candidate.rating, candidate.reviewsCount);
  const price = formatSwipePrice(candidate.pricePerHourRub);
  const friends = swipeFriendsLine(candidate.friendsHere);
  const match = swipeMatchLine(candidate.matchPercent);
  // Улетающая карточка несёт свой вердикт как штамп и полную подсветку, даже если решение пришло
  // с кнопки или быстрым фликом и она почти не сдвинулась: иначе она уходила бы «пустой».
  const progress = leaving === null ? swipeProgress(dx) : leaving === "like" ? 1 : -1;
  const cardClass = ["app-swipe-card", settling ? "app-swipe-card--settling" : "", leaving === "like" ? "app-swipe-card--fly-like" : leaving === "skip" ? "app-swipe-card--fly-skip" : ""].filter(Boolean).join(" ");
  // Прогресс решения уходит в CSS-переменную: подсветку и её половины рисует theme.css, а не React
  const style = { ...gesture?.style, transform: `translateX(${dx}px) rotate(${dx / 24}deg)`, "--app-swipe-progress": progress } as CSSProperties;

  function onAnimationEnd(event: ReactAnimationEvent<HTMLDivElement>): void {
    // Только собственный animationend: «хлопок» штампа внутри карточки всплывает сюда же и снял бы её на полпути
    if (event.target === event.currentTarget) onLeft?.();
  }

  return (
    <div className={cardClass} {...gesture} style={style} onAnimationEnd={leaving === null ? undefined : onAnimationEnd}>
      <img className="app-swipe-photo" src={pictured(candidate.place.id, candidate.previewUrl)} alt="" />
      <span className="app-swipe-glow" aria-hidden="true" />
      <span className="app-swipe-glow app-swipe-glow--cool" aria-hidden="true" />
      <span className="app-swipe-tint app-swipe-tint--like" aria-hidden="true" />
      <span className="app-swipe-tint app-swipe-tint--skip" aria-hidden="true" />
      <span className="app-swipe-chips">
        {candidate.offerLabel !== null && <span className="app-swipe-chip">{candidate.offerLabel}</span>}
        {distance !== null && <span className="app-swipe-chip">{distance}</span>}
      </span>
      <span className="app-swipe-save" aria-hidden="true">
        <ActionIcon name="heart" size={20} />
      </span>
      {progress > 0.12 && (
        <span className="app-swipe-fly app-swipe-fly--like" style={{ opacity: Math.min(1, progress * 1.5), transform: `translate(-50%, ${-20 - progress * 36}%) scale(${0.55 + Math.min(progress, 1) * 0.55})` }}>
          <ActionIcon name="heart" size={36} />В избранное
        </span>
      )}
      {progress < -0.12 && (
        <span className="app-swipe-fly app-swipe-fly--skip" style={{ opacity: Math.min(1, -progress * 1.5), transform: `translate(-50%, ${-20 + progress * 36}%) scale(${0.55 + Math.min(-progress, 1) * 0.55})` }}>
          Мимо
        </span>
      )}
      <div className="app-swipe-veil">
        {candidate.areaLine !== null && <p className="app-swipe-area">{candidate.areaLine}</p>}
        <h2 className="app-swipe-title">{candidate.place.title}</h2>
        <p className="app-swipe-facts">
          {rating !== null && (
            <span className="app-swipe-rating">
              <ActionIcon name="star" size={14} filled />
              {rating}
            </span>
          )}
          {price !== null && <span className="app-swipe-price">{price}</span>}
        </p>
        {candidate.amenities.length > 0 && (
          <p className="app-swipe-amenities">
            {candidate.amenities.map((amenity) => (
              <span key={amenity} className="app-swipe-amenity">
                {amenity}
              </span>
            ))}
          </p>
        )}
        {(friends !== null || match !== null) && (
          <p className="app-swipe-social">
            {candidate.friendsHere.length > 0 && (
              <span className="app-swipe-faces" aria-hidden="true">
                {candidate.friendsHere.slice(0, 2).map((friend) => (
                  <span key={friend.id} className="app-swipe-face">
                    {friend.name.charAt(0)}
                  </span>
                ))}
              </span>
            )}
            <span className="app-swipe-social-text">{[friends, match].filter((part): part is string => part !== null).join(" · ")}</span>
          </p>
        )}
        <span className="app-swipe-foot">
          <button type="button" className="app-swipe-more" onClick={onOpen}>
            Подробнее
          </button>
          <button type="button" className="app-swipe-open" aria-label={`Открыть «${candidate.place.title}»`} onClick={onOpen}>
            <ActionIcon name="chevron" size={20} strokeWidth={2} />
          </button>
        </span>
      </div>
    </div>
  );
}

interface SwipeViewProps {
  state: SwipeState;
  index: number;
  dx: number;
  category: SwipeCategory;
  notice?: string | null;
  onCategory: (category: SwipeCategory) => void;
  onDecide: (decision: SwipeDecision) => void;
  onUndo: () => void;
  onGather: () => void;
  onOpen: (placeId: string) => void;
  onBack: () => void;
  onRetry: () => void;
  settling?: boolean;
  gesture?: SwipeGestureProps;
  /** Решённая карточка, которая ещё улетает поверх следующей. */
  leaving?: SwipeLeaving | null;
  onLeft?: () => void;
}

export function SwipeView(props: SwipeViewProps) {
  const [filters, setFilters] = useState(false);
  const deck = props.state.status === "ready" ? props.state.candidates.slice(props.index) : [];
  const [top] = deck;
  const leaving = props.leaving ?? null;
  return (
    <div className="app-swipe">
      <header className="app-swipe-head">
        <span className="app-swipe-head-side" />
        <h1 className="app-screen-title">Подбор мест</h1>
        <button type="button" className="app-swipe-filter" aria-label="Фильтр" aria-pressed={filters} onClick={() => setFilters((open) => !open)}>
          <ActionIcon name="filter" size={20} />
        </button>
      </header>
      <p className="app-swipe-hint">Свайпай: вправо — в избранное, влево — мимо</p>
      {filters && (
        <div className="app-line-tabs" role="tablist" aria-label="Категория мест">
          {SWIPE_CATEGORIES.map((category) => (
            <button key={category} type="button" role="tab" aria-selected={props.category === category} className={props.category === category ? "app-line-tab app-line-tab--on" : "app-line-tab"} onClick={() => props.onCategory(category)}>
              {SWIPE_CATEGORY_LABELS[category]}
            </button>
          ))}
        </div>
      )}
      <div className={leaving === null ? "app-swipe-deck" : "app-swipe-deck app-swipe-deck--leaving"}>
        {props.state.status === "loading" && <AppSkeleton variant="block" className="app-swipe-skeleton" />}
        {props.state.status === "error" && (
          <AppState error action={{ label: "Повторить", onClick: props.onRetry }}>
            Не удалось загрузить подборку мест.
          </AppState>
        )}
        {props.state.status === "ready" && top === undefined && <AppState hint="Смени фильтр или загляни позже">Места в этой подборке кончились</AppState>}
        {top !== undefined && (
          <>
            {/* Две тени под верхней карточкой: колода, а не одинокая карточка */}
            {deck[2] !== undefined && <span className="app-swipe-shadow app-swipe-shadow--far" aria-hidden="true" />}
            {deck[1] !== undefined && <span className="app-swipe-shadow" aria-hidden="true" />}
            {/* key по месту: следующая карточка — новый элемент, и она поднимается из-под теней, а не подменяет текст в старом */}
            <SwipeCard key={top.place.id} candidate={top} dx={props.dx} settling={props.settling} gesture={props.gesture} onOpen={() => props.onOpen(top.place.id)} />
          </>
        )}
        {/* Решённая карточка улетает поверх следующей; контейнер снимает её по animationend */}
        {leaving !== null && <SwipeCard key={`leaving-${leaving.candidate.place.id}`} candidate={leaving.candidate} dx={leaving.dx} leaving={leaving.decision} onOpen={() => {}} onLeft={props.onLeft} />}
      </div>
      <div className="app-swipe-actions">
        <button type="button" className="app-swipe-action app-swipe-action--skip" aria-label="Мимо" disabled={top === undefined} onClick={() => props.onDecide("skip")}>
          <ActionIcon name="close" size={24} strokeWidth={2} />
        </button>
        <button type="button" className="app-swipe-action app-swipe-action--undo" aria-label="Вернуть карточку" disabled={props.index === 0} onClick={props.onUndo}>
          <ActionIcon name="undo" size={20} />
        </button>
        <button type="button" className="app-swipe-action app-swipe-action--like" aria-label="В избранное" disabled={top === undefined} onClick={() => props.onDecide("like")}>
          <ActionIcon name="heart" size={26} />
        </button>
        <button type="button" className="app-swipe-action app-swipe-action--gather" aria-label="Позвать друзей" disabled={top === undefined} onClick={props.onGather}>
          <ActionIcon name="users" size={20} />
        </button>
      </div>
      {props.notice !== null && props.notice !== undefined && (
        <p className="app-cal-reminder" role="status">
          {props.notice}
        </p>
      )}
    </div>
  );
}

export function SwipePage() {
  const { navigate, back } = useRoute();
  const origin = useViewerOrigin();
  const [homeCity, setHomeCity] = useState<string | null>(null);
  const [category, setCategory] = useState<SwipeCategory>("all");
  const [state, setState] = useState<SwipeState>({ status: "loading" });
  const [index, setIndex] = useState(0);
  const [undoNotice, setUndoNotice] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [leaving, setLeaving] = useState<SwipeLeaving | null>(null);
  // Последнее смещение под пальцем: хук обнуляет своё до того, как сообщит о жесте, а улёт должен
  // начаться там, где карточку отпустили.
  const lastOffset = useRef(0);
  const top = state.status === "ready" ? state.candidates[index] : undefined;
  const point = useMemo(() => (homeCity === null ? origin : browsedCityOrigin(origin, homeCity)), [origin, homeCity]);

  useEffect(() => {
    if (!undoNotice) return;
    const timer = window.setTimeout(() => setUndoNotice(false), 2800);
    return () => window.clearTimeout(timer);
  }, [undoNotice]);

  useEffect(() => {
    let alive = true;
    apiClient.getProfile().then(
      (profile) => {
        if (alive) setHomeCity(profile.city);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    setIndex(0);
    setLeaving(null);
    apiClient.listSwipeCandidates(category, { latitude: point.latitude, longitude: point.longitude }).then(
      (candidates) => {
        if (alive) setState({ status: "ready", candidates });
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [category, point.latitude, point.longitude, attempt]);

  const decide = useCallback(
    (decision: SwipeDecision, dx = 0) => {
      if (top === undefined) return;
      setIndex((current) => current + 1);
      // The card does not vanish, it flies off: it lives in `leaving` until the fly-out ends and SwipeCard reports animationend.
      setLeaving({ candidate: top, decision, dx });
      // A rejected write must not take the card back: the deck is a queue the viewer already moved on from.
      void apiClient.saveSwipeDecision(top.place.id, decision).catch(() => {});
    },
    [top],
  );

  // Экран так и называется — подбор свайпами. Карточка идёт точно за пальцем (без затухания:
  // она и должна уехать), решение берётся тем же порогом, что рисует на ней штамп, а отпущенная
  // на полпути возвращается домой. Кнопки под колодой делают ровно то же самое.
  const drag = useSwipeDrag({
    axis: "x",
    distancePx: SWIPE_COMMIT_PX,
    disabled: top === undefined,
    onOffset: (offset) => {
      lastOffset.current = offset;
    },
    onSwipe: (direction) => decide(direction === "right" ? "like" : "skip", lastOffset.current),
  });

  return (
    <SwipeView
      state={state}
      index={index}
      dx={drag.offset}
      settling={drag.settling}
      gesture={drag.gesture}
      leaving={leaving}
      onLeft={() => setLeaving(null)}
      category={category}
      notice={undoNotice ? "Карточка возвращена для просмотра — решение уже учтено" : null}
      onCategory={setCategory}
      onDecide={(decision) => decide(decision)}
      // Undo steps the deck back locally: the swipe is already recorded, and unsaying it needs an endpoint that does not exist (#498).
      // The card still flying off is dropped at once: the one coming back is the card the viewer wants to see.
      onUndo={() => {
        setLeaving(null);
        setIndex((current) => Math.max(0, current - 1));
        setUndoNotice(true);
      }}
      onGather={() => navigate({ name: "plan-new" })}
      onOpen={(id) => navigate({ name: "place", id })}
      onBack={back}
      onRetry={() => setAttempt((count) => count + 1)}
    />
  );
}
