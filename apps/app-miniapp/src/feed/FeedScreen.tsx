// START_MODULE_CONTRACT
// PURPOSE: Экран 03 «Лента» and экран 04 «Лента · загрузка»: the stories rail, the «Куда пойдём?» block and the feed of friend and venue posts with its skeleton.
// SCOPE: The home feed only — cards via apiClient.listFeedCards, «Пойду» via setParticipationStatus/deleteParticipation, the venue status block via setPlaceParticipationStatus. The impression wall of one event or one place stays in ./FeedPage.tsx.
// DEPENDS: ../api/client.js (apiClient, FeedCard/FeedFriendCard/FeedPlaceCard/FeedCardCounts), ../auth/AuthContext.js, ../routing/router.js, ../catalog/format.js (CATEGORY_LABELS, pluralRu), ../max/bridge.js (shareResult, webApp), ./FeedPage.js (StoriesRow), ../ui/primitives.js, ../ui/icons.js, ../ui/theme.css
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - FEED_PLACE_STATUSES - the four participation statuses the venue block offers, in design order
// - FEED_PLACE_STATUS_LABELS - ru label per offered status (kept local: importing the event page table would pull the lazy event screen into the home chunk)
// - formatFeedDistance - «1,2 км»; null when the card carries no distance (#496)
// - formatFeedTravel - «15 минут от тебя (2,4 км)», the distance alone without a walking estimate
// - formatFeedWhen - «Сегодня · 20:00» / «Завтра · 10:00» / «Сб, 19 сент. · 14:00»
// - formatFeedEntry - условие входа: «бесплатно» or the price
// - feedEventMeta - the line under the hero title: when plus entry condition
// - feedCountsLine - «12 хотят пойти · 4 уже там»; null when the card counts nothing (#496)
// - formatFeedAgo - «только что» / «25 минут назад» / «2 часа назад» / «вчера» / a date past the week
// - feedCommentsLine - «Дима: буду к трём · ещё 2 комментария»; null without comments
// - feedGoingFriendsLine - «Идёт Анна +1»; null when no friend is going
// - formatPricePerHour - «800 ₽/час»; null until the slot domain answers a price (#492)
// - formatFeedRating - «4.9»; null until the card carries a rating (#496)
// - FeedWhereToCard - «Куда пойдём?» block with the single gradient CTA of the screen
// - FeedFriendPost - friend post: author, event hero with its chips, «Пойду», counters, caption, comments, time
// - FeedPlacePost - venue post: place header with rating and travel time, slot offer hero, friend quote, «Твой статус на этой площадке», «Выбрать слот» / «Собрать»
// - FeedCardHandlers - what the card list needs from its container (open, like, going, venue status, share)
// - FeedCardList - presentational list of cards, each rendered by its kind
// - FeedSkeletonScreen - экран 04: stories and post skeletons pulsing void 6% → 10% over 1.2s
// - FeedScreenState - union of the feed fetch states (loading / error / ready)
// - FeedScreen - экран 03 container: stories rail, «Куда пойдём?», cards with their writes
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";
import type { Event, Friend, ParticipationStatus } from "@max-events/api-contracts";
import { apiClient, type FeedCard, type FeedCardCounts, type FeedComment, type FeedFriendCard, type FeedPlaceCard } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { CATEGORY_LABELS, pluralRu } from "../catalog/format";
import { shareResult, webApp } from "../max/bridge";
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { AppChip, AppEmptyState, AppSkeleton, AppState } from "../ui/primitives";
import { StoriesRow } from "./FeedPage";

/** The enum has six statuses; the venue block of the design offers these four, in this order. */
export const FEED_PLACE_STATUSES = ["wants_to_go", "going", "looking_for_company", "looking_for_travel_buddy"] as const satisfies readonly ParticipationStatus[];

/** Deliberately not imported from the event page: that module is lazy, and one import would drag the whole event screen into the home chunk. */
export const FEED_PLACE_STATUS_LABELS: Record<(typeof FEED_PLACE_STATUSES)[number], string> = {
  wants_to_go: "Хочу пойти",
  going: "Иду",
  looking_for_company: "Ищу компанию",
  looking_for_travel_buddy: "Ищу попутчика",
};

const DAY_MS = 24 * 60 * 60 * 1000;

const firstName = (name: string): string => name.split(" ")[0];

const startOfDay = (date: Date): number => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** «1,2 км» — ru decimal comma, one digit; the design never shows metres. */
export function formatFeedDistance(distanceKm: number | null): string | null {
  return distanceKm === null ? null : `${distanceKm.toLocaleString("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} км`;
}

/** «15 минут от тебя (2,4 км)»; without a walking estimate the distance alone, and null when neither is known. */
export function formatFeedTravel(travelMinutes: number | null, distanceKm: number | null): string | null {
  const distance = formatFeedDistance(distanceKm);
  if (travelMinutes === null) return distance;
  const walk = `${travelMinutes} ${pluralRu(travelMinutes, "минута", "минуты", "минут")} от тебя`;
  return distance === null ? walk : `${walk} (${distance})`;
}

/** «Сегодня · 20:00» while the event is today, «Завтра · 10:00» tomorrow, otherwise «Сб, 19 сент. · 14:00». */
export function formatFeedWhen(startsAt: string, now: Date): string {
  const date = new Date(startsAt);
  const time = date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const days = Math.round((startOfDay(date) - startOfDay(now)) / DAY_MS);
  if (days === 0) return `Сегодня · ${time}`;
  if (days === 1) return `Завтра · ${time}`;
  const day = date.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" });
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${time}`;
}

/** Условие входа, as the hero line spells it: a free event says so in words, a paid one shows its price. */
export function formatFeedEntry(event: Pick<Event, "isPaid" | "priceRub">): string {
  return event.isPaid && event.priceRub !== null ? `${event.priceRub.toLocaleString("ru-RU")} ₽` : "бесплатно";
}

/** «Сегодня · 20:00 · бесплатно» — the meta line under the hero title. */
export function feedEventMeta(event: Pick<Event, "startsAt" | "isPaid" | "priceRub">, now: Date): string {
  return `${formatFeedWhen(event.startsAt, now)} · ${formatFeedEntry(event)}`;
}

/**
 * «12 хотят пойти · 4 уже там». A running event counts people who are already there, an upcoming one
 * people who are going. Null rather than a zero when the card counts nothing: the counters are not in
 * the list DTO yet (#496), and «0 идут» would read as an answer instead of a gap.
 */
export function feedCountsLine(counts: FeedCardCounts, live: boolean): string | null {
  const parts: string[] = [];
  if (counts.wantsToGo !== null) parts.push(`${counts.wantsToGo} ${pluralRu(counts.wantsToGo, "хочет", "хотят", "хотят")} пойти`);
  if (counts.going !== null) parts.push(live ? `${counts.going} уже там` : `${counts.going} ${pluralRu(counts.going, "идёт", "идут", "идут")}`);
  if (counts.waitlist !== null) parts.push(`${counts.waitlist} в листе ожидания`);
  if (counts.freeSeats !== null) parts.push(`${counts.freeSeats} ${pluralRu(counts.freeSeats, "место", "места", "мест")} свободно`);
  return parts.length === 0 ? null : parts.join(" · ");
}

/** Relative time of the post: minutes, hours, «вчера», days, and a plain date once the week is past. */
export function formatFeedAgo(publishedAt: string, now: Date): string {
  const minutes = Math.floor((now.getTime() - Date.parse(publishedAt)) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} ${pluralRu(minutes, "минуту", "минуты", "минут")} назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${pluralRu(hours, "час", "часа", "часов")} назад`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "вчера";
  if (days < 7) return `${days} ${pluralRu(days, "день", "дня", "дней")} назад`;
  return new Date(publishedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

/** «Дима: буду к трём · ещё 2 комментария»; the count is the whole thread, the list only its head. */
export function feedCommentsLine(comments: FeedComment[], commentsCount: number): string | null {
  const first = comments[0];
  if (first === undefined) return null;
  const head = `${firstName(first.author.name)}: ${first.text}`;
  const rest = Math.max(0, commentsCount - comments.length);
  return rest === 0 ? head : `${head} · ещё ${rest} ${pluralRu(rest, "комментарий", "комментария", "комментариев")}`;
}

/** «Идёт Анна +1» — the hero pill over a venue post; null when no friend is going. */
export function feedGoingFriendsLine(friends: Friend[]): string | null {
  const first = friends[0];
  if (first === undefined) return null;
  const rest = friends.length - 1;
  return rest === 0 ? `Идёт ${firstName(first.name)}` : `Идёт ${firstName(first.name)} +${rest}`;
}

/** «800 ₽/час»; null until the slot domain answers a price (#492). */
export function formatPricePerHour(pricePerHourRub: number | null): string | null {
  return pricePerHourRub === null ? null : `${pricePerHourRub.toLocaleString("ru-RU")} ₽/час`;
}

/** «4.9» — one digit, as the rating pill prints it; null until the card carries a rating (#496). */
export function formatFeedRating(rating: number | null): string | null {
  return rating === null ? null : rating.toFixed(1);
}

export function FeedWhereToCard({ onStart }: { onStart: () => void }) {
  return (
    <section className="app-feed-whereto" aria-label="Куда пойдём?">
      <span className="app-feed-whereto-text">
        <span className="app-feed-whereto-title">Куда пойдём?</span>
        <span className="app-feed-whereto-hint">Три вопроса — и план на вечер</span>
      </span>
      <button type="button" className="app-feed-whereto-start" onClick={onStart}>
        Начать
        <ActionIcon name="chevron" size={18} strokeWidth={2} />
      </button>
    </section>
  );
}

interface FeedFriendPostProps {
  card: FeedFriendCard;
  now: Date;
  onOpenEvent: (eventId: string) => void;
  onToggleLike: () => void;
  onToggleGoing: () => void;
  onOpenComments: () => void;
  onShare: () => void;
}

export function FeedFriendPost({ card, now, onOpenEvent, onToggleLike, onToggleGoing, onOpenComments, onShare }: FeedFriendPostProps) {
  const where = [card.placeTitle, formatFeedDistance(card.distanceKm)].filter((part): part is string => part !== null && part !== "").join(" · ");
  const counts = feedCountsLine(card.counts, card.live);
  const comments = feedCommentsLine(card.comments, card.commentsCount);
  const going = card.myStatus === "going";
  return (
    <article className="app-feed-post">
      <header className="app-feed-post-head">
        <span className="app-feed-ring" aria-hidden="true">
          <span className="app-feed-ring-inner">{card.author.name.charAt(0)}</span>
        </span>
        <span className="app-feed-post-id">
          <span className="app-feed-post-author">{card.author.name}</span>
          {where !== "" && <span className="app-feed-post-where">{where}</span>}
        </span>
      </header>
      <button type="button" className={`app-feed-hero app-media--${card.event.category}`} onClick={() => onOpenEvent(card.event.id)}>
        <span className="app-feed-hero-glow" aria-hidden="true" />
        <span className="app-feed-hero-glow app-feed-hero-glow--cool" aria-hidden="true" />
        <span className="app-feed-hero-chips">
          <span className="app-feed-chip">{CATEGORY_LABELS[card.event.category]}</span>
          {card.live && (
            <span className="app-feed-chip app-feed-chip--live">
              <span className="app-feed-live-dot" aria-hidden="true" />
              Сейчас идёт
            </span>
          )}
          {card.hit && <span className="app-feed-hit">ХИТ НЕДЕЛИ</span>}
        </span>
        <span className="app-feed-hero-veil">
          <span className="app-feed-hero-title">{card.event.title}</span>
          <span className="app-feed-hero-meta">{feedEventMeta(card.event, now)}</span>
        </span>
      </button>
      <div className="app-feed-actions">
        <button type="button" className="app-post-action" aria-pressed={card.likedByMe} aria-label="Нравится" onClick={onToggleLike}>
          <ActionIcon filled={card.likedByMe} name="heart" size={26} />
        </button>
        <button type="button" className="app-post-action" aria-label="Комментарии" onClick={onOpenComments}>
          <ActionIcon name="comment" size={26} />
        </button>
        <button type="button" className="app-post-action" aria-label="Поделиться" onClick={onShare}>
          <ActionIcon name="share" size={26} />
        </button>
        {/* aria-pressed, not two labels alone: «Иду» is the same control in its on state, not another button. */}
        <button type="button" className={going ? "app-feed-going app-feed-going--on" : "app-feed-going"} aria-pressed={going} onClick={onToggleGoing}>
          {going ? "Иду" : "Пойду"}
        </button>
      </div>
      {counts !== null && <p className="app-feed-counts">{counts}</p>}
      <p className="app-feed-caption">
        <span className="app-feed-caption-author">{card.author.name}</span> {card.text}
      </p>
      {comments !== null && (
        <button type="button" className="app-feed-comments" onClick={onOpenComments}>
          {comments}
        </button>
      )}
      <p className="app-feed-time">{formatFeedAgo(card.publishedAt, now)}</p>
    </article>
  );
}

interface FeedPlacePostProps {
  card: FeedPlaceCard;
  now: Date;
  onOpenPlace: (placeId: string) => void;
  onStatus: (status: ParticipationStatus) => void;
  onSlots: () => void;
  onGather: () => void;
}

export function FeedPlacePost({ card, now, onOpenPlace, onStatus, onSlots, onGather }: FeedPlacePostProps) {
  const travel = formatFeedTravel(card.travelMinutes, card.distanceKm);
  const rating = formatFeedRating(card.rating);
  const price = formatPricePerHour(card.pricePerHourRub);
  const friends = feedGoingFriendsLine(card.goingFriends);
  return (
    <article className="app-feed-post app-feed-post--place">
      <header className="app-feed-post-head">
        <span className="app-feed-place-avatar" aria-hidden="true">
          {card.place.title.charAt(0)}
        </span>
        <span className="app-feed-post-id">
          <span className="app-feed-place-name">
            <span>{card.place.title}</span>
            {card.verified && (
              <span className="app-feed-verified" aria-label="Проверенная площадка">
                <ActionIcon name="check" size={14} strokeWidth={2.4} />
              </span>
            )}
          </span>
          <span className="app-feed-place-where">
            <ActionIcon name="pin" size={12} />
            {card.place.address}
            {travel !== null && <span className="app-feed-travel">{travel}</span>}
          </span>
        </span>
        {rating !== null && (
          <span className="app-feed-rating" aria-label={`Рейтинг ${rating}`}>
            <ActionIcon name="star" size={13} />
            {rating}
          </span>
        )}
      </header>
      <button type="button" className="app-feed-hero app-feed-hero--place" onClick={() => onOpenPlace(card.place.id)}>
        <span className="app-feed-hero-glow" aria-hidden="true" />
        <span className="app-feed-hero-glow app-feed-hero-glow--cool" aria-hidden="true" />
        <span className="app-feed-hero-chips">
          {card.offerLabel !== null && <span className="app-feed-chip">{card.offerLabel}</span>}
          {card.slotLabel !== null && (
            <span className="app-feed-chip app-feed-chip--slot">
              <ActionIcon name="clock" size={14} />
              {card.slotLabel}
            </span>
          )}
        </span>
        <span className="app-feed-hero-foot">
          {friends !== null && (
            <span className="app-feed-hero-pill">
              <span className="app-feed-faces" aria-hidden="true">
                {card.goingFriends.slice(0, 2).map((friend) => (
                  <span key={friend.id} className="app-feed-face">
                    {friend.name.charAt(0)}
                  </span>
                ))}
              </span>
              {friends}
            </span>
          )}
          {price !== null && <span className="app-feed-hero-pill app-feed-hero-pill--price">{price}</span>}
        </span>
      </button>
      {/* Counters without controls: a venue post is not a feed post, so there is nothing to like or comment on yet (#492). */}
      <div className="app-feed-actions">
        <span className="app-feed-count">
          <ActionIcon name="heart" size={22} />
          {card.likesCount}
        </span>
        <span className="app-feed-count">
          <ActionIcon name="comment" size={22} />
          {card.commentsCount}
        </span>
      </div>
      <h3 className="app-feed-place-title">{card.title}</h3>
      <p className="app-feed-place-text">{card.text}</p>
      {card.quote !== null && (
        <blockquote className="app-feed-quote">
          <span className="app-feed-quote-author">{firstName(card.quote.author.name)}:</span> <span className="app-feed-quote-text">«{card.quote.text}»</span>
        </blockquote>
      )}
      <p className="app-feed-status-label">Твой статус на этой площадке</p>
      <div className="app-feed-status-chips">
        {FEED_PLACE_STATUSES.map((status) => (
          <AppChip key={status} pressed={card.myStatus === status} onClick={() => onStatus(status)}>
            {FEED_PLACE_STATUS_LABELS[status]}
          </AppChip>
        ))}
      </div>
      <div className="app-feed-place-actions">
        <button type="button" className="app-feed-slot" onClick={onSlots}>
          {price === null ? "Выбрать слот" : `Выбрать слот · ${price}`}
          <ActionIcon name="chevron" size={18} strokeWidth={2} />
        </button>
        <button type="button" className="app-feed-gather" onClick={onGather}>
          <ActionIcon name="user" size={18} />
          Собрать
        </button>
      </div>
      <p className="app-feed-time">Пост площадки · {formatFeedAgo(card.publishedAt, now)}</p>
    </article>
  );
}

export interface FeedCardHandlers {
  onOpenEvent: (eventId: string) => void;
  onOpenPlace: (placeId: string) => void;
  onToggleLike: (card: FeedFriendCard) => void;
  onToggleGoing: (card: FeedFriendCard) => void;
  onOpenComments: (card: FeedFriendCard) => void;
  onShare: (card: FeedFriendCard) => void;
  onPlaceStatus: (card: FeedPlaceCard, status: ParticipationStatus) => void;
  onSlots: (card: FeedPlaceCard) => void;
  onGather: (card: FeedPlaceCard) => void;
}

export function FeedCardList({ cards, now, handlers }: { cards: FeedCard[]; now: Date; handlers: FeedCardHandlers }) {
  return <div className="app-feed-posts">{cards.map((card) => (card.kind === "friend" ? <FeedFriendPost key={card.id} card={card} now={now} onOpenEvent={handlers.onOpenEvent} onToggleLike={() => handlers.onToggleLike(card)} onToggleGoing={() => handlers.onToggleGoing(card)} onOpenComments={() => handlers.onOpenComments(card)} onShare={() => handlers.onShare(card)} /> : <FeedPlacePost key={card.id} card={card} now={now} onOpenPlace={handlers.onOpenPlace} onStatus={(status) => handlers.onPlaceStatus(card, status)} onSlots={() => handlers.onSlots(card)} onGather={() => handlers.onGather(card)} />))}</div>;
}

/** Экран 04: the rows are aria-hidden, so the status label is what assistive tech reads. */
export function FeedSkeletonScreen({ posts = 2, stories = 5 }: { posts?: number; stories?: number }) {
  return (
    <div className="app-feed-skeleton" role="status" aria-label="Загружаем ленту">
      <div className="app-feed-skeleton-stories" aria-hidden="true">
        {Array.from({ length: stories }, (_, index) => (
          <div key={index} className="app-feed-skeleton-story">
            <AppSkeleton variant="block" className="app-feed-skeleton-ring" />
            <AppSkeleton width="44px" />
          </div>
        ))}
      </div>
      {Array.from({ length: posts }, (_, index) => (
        <div key={index} className="app-feed-skeleton-post" aria-hidden="true">
          <div className="app-feed-skeleton-head">
            <AppSkeleton variant="block" className="app-feed-skeleton-avatar" />
            <span className="app-feed-skeleton-lines">
              <AppSkeleton width="140px" />
              <AppSkeleton variant="line-short" width="90px" />
            </span>
          </div>
          <AppSkeleton variant="block" className="app-feed-skeleton-hero" />
          <div className="app-feed-skeleton-actions">
            <AppSkeleton variant="block" className="app-feed-skeleton-action" />
            <AppSkeleton variant="block" className="app-feed-skeleton-action" />
            <AppSkeleton variant="block" className="app-feed-skeleton-action" />
            <AppSkeleton variant="block" className="app-feed-skeleton-cta" />
          </div>
          <div className="app-feed-skeleton-body">
            <AppSkeleton width="120px" />
            <AppSkeleton width="100%" />
            <AppSkeleton width="62%" />
          </div>
        </div>
      ))}
    </div>
  );
}

export type FeedScreenState = { status: "loading" } | { status: "error" } | { status: "ready"; cards: FeedCard[] };

export function FeedScreen() {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const { navigate } = useRoute();
  const [state, setState] = useState<FeedScreenState>({ status: "loading" });
  const now = new Date();

  const fetchCards = useCallback(
    (initial: boolean) => {
      if (initial) setState({ status: "loading" });
      apiClient.listFeedCards(userId ?? "").then(
        (cards) => setState({ status: "ready", cards }),
        // A failed refresh after a write must not blank a feed that is already on screen.
        () => setState((current) => (initial ? { status: "error" } : current)),
      );
    },
    [userId],
  );

  useEffect(() => {
    fetchCards(true);
  }, [fetchCards]);

  // Both paths re-read the feed: a rejected write must leave the screen showing what the server holds, not what the tap implied.
  const settle = useCallback(
    (request: Promise<unknown>) =>
      request.then(
        () => fetchCards(false),
        () => fetchCards(false),
      ),
    [fetchCards],
  );

  const handlers: FeedCardHandlers = {
    onOpenEvent: (eventId) => navigate({ name: "event", id: eventId }),
    onOpenPlace: (placeId) => navigate({ name: "place", id: placeId }),
    onToggleLike: (card) => {
      if (userId === null) return;
      void settle(apiClient.toggleFeedLike(card.id, userId));
    },
    onToggleGoing: (card) => {
      if (userId === null) return;
      void settle(card.myStatus === "going" ? apiClient.deleteParticipation(card.event.id, userId) : apiClient.setParticipationStatus(card.event.id, userId, "going"));
    },
    // The thread lives on the event wall; the card shows only its head.
    onOpenComments: (card) => navigate({ name: "event", id: card.event.id }),
    onShare: (card) => void shareResult(webApp, `${card.author.name} — ${card.event.title}: ${card.text}`),
    onPlaceStatus: (card, status) => {
      if (userId === null) return;
      void settle(apiClient.setPlaceParticipationStatus(card.place.id, userId, card.myStatus === status ? null : status));
    },
    // Экран 19 «слоты» is not built yet (#492), so the venue page is where picking a slot starts.
    onSlots: (card) => navigate({ name: "place", id: card.place.id }),
    onGather: () => navigate({ name: "plan-new" }),
  };

  if (state.status === "loading") return <FeedSkeletonScreen />;

  return (
    <section className="app-feed" aria-label="Лента">
      <StoriesRow />
      <FeedWhereToCard onStart={() => navigate({ name: "whereto" })} />
      {state.status === "error" ? (
        <AppState error action={{ label: "Повторить", onClick: () => fetchCards(true) }}>
          Не удалось загрузить ленту.
        </AppState>
      ) : state.cards.length === 0 ? (
        <AppEmptyState kind="empty-feed" onAction={() => navigate({ name: "create" })} />
      ) : (
        <FeedCardList cards={state.cards} now={now} handlers={handlers} />
      )}
    </section>
  );
}
