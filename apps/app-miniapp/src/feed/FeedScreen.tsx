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
// - FeedFriendPost - friend post in the Instagram order: author and pinned event, full-bleed photo, actions, counters, caption, time. Comments open only from the comment control
// - FeedPlacePost - venue post: place header with rating and travel time, slot offer hero, friend quote, «Твой статус на этой площадке», «Выбрать слот» / «Собрать»
// - FeedCardHandlers - what the card list needs from its container (open, like, going, venue status, share)
// - FeedCardList - presentational list of cards, each rendered by its kind
// - FeedSkeletonScreen - экран 04: stories and post skeletons pulsing void 6% → 10% over 1.2s
// - FeedScreenState - union of the feed fetch states (loading / error / ready)
// - FeedScreen - экран 03 container: stories rail, «Куда пойдём?», cards with their writes
// END_MODULE_MAP

import { Component, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Event, Friend, ParticipationStatus } from "@max-events/api-contracts";
import { apiClient, type FeedCard, type FeedCardCounts, type FeedComment, type FeedFriendCard, type FeedPlaceCard } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { CATEGORY_LABELS, pluralRu } from "../catalog/format";
import { announceShare, getWebApp, shareResult } from "../max/bridge";
import { sharePayload } from "../max/links";
import { freezeScroll, savedScroll } from "../ui/scroll-memory";
import { useRoute } from "../routing/router";
import { ActionIcon } from "../ui/icons";
import { pictured } from "../ui/photos";
import { LikeFaces, PostText } from "./post-body";
import { CommentSheet } from "./FeedPage";
import { parsePinLabel, placePinTitle } from "../ui/pin-label";
import { SaveToList } from "../event/SaveToList";
import { AppChip, AppEmptyState, AppSkeleton, AppState } from "../ui/primitives";
import { PhotoGallery } from "./gallery";
import { PostAuthorAvatar, StoriesRow } from "./FeedPage";

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
const FEED_WALK_CAP_MIN = 90;
const FEED_FAR_KM = 80;

export function formatFeedTravel(travelMinutes: number | null, distanceKm: number | null): string | null {
  if (distanceKm !== null && distanceKm > FEED_FAR_KM) return "далеко";
  if (travelMinutes !== null && travelMinutes > FEED_WALK_CAP_MIN) {
    const km = distanceKm ?? Math.max(1, Math.round((travelMinutes * 80) / 1000));
    if (km > FEED_FAR_KM) return "далеко";
    return distanceKm === null ? `${km.toLocaleString("ru-RU")} км` : formatFeedDistance(distanceKm);
  }
  const distance = formatFeedDistance(distanceKm);
  if (travelMinutes === null) return distance;
  const walk = `${travelMinutes} ${pluralRu(travelMinutes, "минута", "минуты", "минут")} от тебя`;
  return distance === null ? walk : `${walk} (${distance})`;
}

/** «Сегодня · 20:00» while the event is today, «Завтра · 10:00» tomorrow, otherwise «Сб, 19 сент. · 14:00». */
export function formatFeedWhen(startsAt: string, now: Date): string {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return "";
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
export function feedCountsLine(counts: FeedCardCounts, live: boolean, friendsGoing?: number | null): string | null {
  const parts: string[] = [];
  const going = friendsGoing === undefined ? counts.going : friendsGoing;
  if (counts.wantsToGo !== null && counts.wantsToGo > 0) parts.push(`${counts.wantsToGo} ${pluralRu(counts.wantsToGo, "хочет", "хотят", "хотят")} пойти`);
  if (going !== null && going > 0) parts.push(friendsGoing === undefined && live ? `${going} уже там` : `${going} ${pluralRu(going, "идёт", "идут", "идут")}`);
  if (counts.waitlist !== null && counts.waitlist > 0) parts.push(`${counts.waitlist} в листе ожидания`);
  if (counts.freeSeats !== null && counts.freeSeats > 0) parts.push(`${counts.freeSeats} ${pluralRu(counts.freeSeats, "место", "места", "мест")} свободно`);
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
  const published = new Date(publishedAt);
  if (Number.isNaN(published.getTime())) return "";
  return published.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
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
  onToggleLike: () => void;
  onToggleGoing: () => void;
  onOpenComments: () => void;
  onShare: () => void;
  onOpenEvent: () => void;
  onOpenAuthor: () => void;
  onOpenPerson?: (userId: string) => void;
  onOpenMark?: () => void;
  onDelete?: () => void;
  userId: string | null;
  hasStory?: boolean;
}

export function FeedFriendPost({ card, now, onToggleLike, onToggleGoing, onShare, onOpenEvent, onOpenAuthor, onOpenPerson, onOpenMark, onDelete, userId, hasStory = false }: FeedFriendPostProps) {
  const [saving, setSaving] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState(card.comments);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<FeedComment | null>(null);
  const commentRef = useRef<HTMLInputElement | null>(null);
  const where = [card.placeTitle, formatFeedDistance(card.distanceKm)].filter((part): part is string => part !== null && part !== "").join(" · ");
  const dropped = parsePinLabel(card.locationLabel ?? card.placeTitle ?? "");
  const markLabel = dropped ? placePinTitle(card.locationLabel ?? card.placeTitle ?? "") : where;
  const canMark = onOpenMark !== undefined && markLabel !== "" && (dropped !== null || (card.event !== null && card.event.placeId !== null));
  const caption = typeof card.text === "string" ? card.text : "";
  const photos = card.photoUrls && card.photoUrls.length > 0 ? card.photoUrls : card.photoUrl ? [card.photoUrl] : [];
  const going = card.goingByMe !== undefined ? card.goingByMe : card.myStatus === "going";
  const mine = userId !== null && card.author.id === userId;
  const eventCover = card.event ? pictured(card.event.id, card.event.coverUrl) : null;
  const showEventMedia = card.event !== null && photos.length === 0;
  return (
    <article className="app-feed-post">
      <header className="app-feed-post-head">
        <button type="button" className="app-feed-author-open" aria-label={`Профиль ${card.author.name}`} onClick={onOpenAuthor}>
          <PostAuthorAvatar friend={card.author} hasStory={hasStory} />
        </button>
        <span className="app-feed-post-id">
          <button type="button" className="app-feed-author-open" aria-label={`Профиль ${card.author.name}`} onClick={onOpenAuthor}>
            <span className="app-feed-post-author">{card.author.name}</span>
          </button>
          {card.event !== null && (
            <button type="button" className="app-feed-post-where" onClick={onOpenEvent}>
              {card.event.title}
            </button>
          )}
          {canMark ? (
            <button type="button" className="app-feed-post-where" onClick={onOpenMark}>
              <ActionIcon name="pin" size={12} />
              <span>{markLabel}</span>
            </button>
          ) : (
            where !== "" && <span className="app-feed-post-where">{where}</span>
          )}
        </span>
      </header>
      {photos.length > 0 && <PhotoGallery photos={photos} />}
      {showEventMedia && card.event !== null && (
        <button type="button" className={`app-feed-event app-media--${card.event.category}`} style={eventCover ? { backgroundImage: `url("${eventCover}")` } : undefined} onClick={onOpenEvent}>
          <img className="app-feed-event-photo" alt="" src={eventCover ?? ""} />
          <span className="app-feed-event-chips">
            <span className="app-feed-chip">{CATEGORY_LABELS[card.event.category]}</span>
            {card.live && (
              <span className="app-feed-chip app-feed-chip--live">
                <span className="app-feed-live-dot" aria-hidden="true" />
                Сейчас идёт
              </span>
            )}
            {card.hit && <span className="app-feed-hit">ХИТ НЕДЕЛИ</span>}
          </span>
          <span className="app-feed-event-title">{card.event.title}</span>
          <span className="app-feed-event-meta">{feedEventMeta(card.event, now)}</span>
        </button>
      )}
      {card.repostOf && (
        <div className="app-feed-embed">
          <button type="button" className="app-feed-embed-author" aria-label={`Профиль ${card.repostOf.author.name}`} onClick={() => (onOpenPerson ? onOpenPerson(card.repostOf!.author.id) : onOpenAuthor())}>
            <PostAuthorAvatar friend={card.repostOf.author} size={28} />
            <span>{card.repostOf.author.name}</span>
          </button>
          {card.repostOf.photoUrl && <img className="app-feed-embed-photo" src={card.repostOf.photoUrl} alt="" />}
          {card.repostOf.text !== "" && <p className="app-feed-embed-text">{card.repostOf.text}</p>}
        </div>
      )}
      <div className="app-feed-actions">
        <button type="button" className="app-post-action" aria-pressed={card.likedByMe} aria-label="Нравится" onClick={onToggleLike}>
          <ActionIcon filled={card.likedByMe} name="heart" size={26} />
          <span>{card.likesCount}</span>
        </button>
        <button type="button" className="app-post-action" aria-label="Комментарии" onClick={() => setCommentsOpen(true)}>
          <ActionIcon name="comment" size={26} />
          <span>{card.commentsCount}</span>
        </button>
        <button type="button" className="app-post-action" aria-label="Отправить друзьям в MAX" onClick={onShare}>
          <ActionIcon name="share" size={26} />
        </button>
        <span className="app-feed-actions-end">
          {userId !== null && (
            <button type="button" className="app-post-action" aria-pressed={saving} aria-label="Сохранить" onClick={() => setSaving(true)}>
              <ActionIcon name="bookmark" size={26} />
            </button>
          )}
          {mine && onDelete !== undefined && (
            <button type="button" className="app-post-action app-post-action--danger" aria-label="Удалить пост" onClick={onDelete}>
              <ActionIcon name="trash" size={26} />
            </button>
          )}
          {/* aria-pressed, not two labels alone: «Иду» is the same control in its on state, not another button. */}
          {card.event !== null && (
            <button type="button" className={going ? "app-feed-going app-feed-going--on" : "app-feed-going"} aria-pressed={going} onClick={onToggleGoing}>
              {going ? <ActionIcon name="check" size={16} /> : null}
              {going ? "Я иду" : "Я пойду"}
            </button>
          )}
        </span>
      </div>
      {saving && userId !== null && <SaveToList feedPostId={card.id} userId={userId} open onClose={() => setSaving(false)} />}
      <LikeFaces people={(card.likedByFriends ?? []).filter((person) => person.id !== userId)} onOpen={onOpenPerson ?? onOpenAuthor} />
      {caption.trim() !== "" && <PostText text={caption} className="app-feed-caption" />}
      {/* No line at all rather than «только что» about a post whose card carries no publication time. */}
      {card.publishedAt !== null && <p className="app-feed-time">{formatFeedAgo(card.publishedAt, now)}</p>}
      {commentsOpen &&
        createPortal(
          <CommentSheet
            comments={comments}
            parents={{}}
            liked={{}}
            replyTo={replyTo}
            draft={draft}
            onDraft={setDraft}
            onClose={() => setCommentsOpen(false)}
            onLike={() => {}}
            onReply={setReplyTo}
            onCancelReply={() => setReplyTo(null)}
            onSubmit={() => {
              const text = draft.trim();
              if (text === "" || userId === null) return;
              void apiClient.addFeedComment(card.id, { userId, text, parentId: replyTo?.id ?? null }).then((next) => {
                setComments(next.comments);
                setDraft("");
                setReplyTo(null);
              });
            }}
            onOpenAuthor={onOpenPerson ?? onOpenAuthor}
            inputRef={commentRef}
          />,
          document.querySelector(".app-root") ?? document.body,
        )}
    </article>
  );
}

interface FeedPlacePostProps {
  card: FeedPlaceCard;
  now: Date;
  onOpenPlace: (placeId: string) => void;
  onOpenPost: () => void;
  onToggleLike?: () => void;
  onStatus: (status: ParticipationStatus) => void;
  onSlots: () => void;
  onGather: () => void;
  onOpenUser?: (userId: string) => void;
  userId?: string | null;
}

function PlaceComments({ postId, userId, onClose, onOpenAuthor }: { postId: string; userId: string | null; onClose: () => void; onOpenAuthor?: (userId: string) => void }) {
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<FeedComment | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    let alive = true;
    apiClient.getFeedPost(postId).then(
      (post) => {
        if (alive) setComments(post.comments);
      },
      () => {
        if (alive) setComments([]);
      },
    );
    return () => {
      alive = false;
    };
  }, [postId]);
  return createPortal(
    <CommentSheet
      comments={comments}
      parents={{}}
      liked={{}}
      replyTo={replyTo}
      draft={draft}
      onDraft={setDraft}
      onClose={onClose}
      onLike={() => {}}
      onReply={setReplyTo}
      onCancelReply={() => setReplyTo(null)}
      onSubmit={() => {
        const text = draft.trim();
        if (text === "" || userId === null) return;
        void apiClient.addFeedComment(postId, { userId, text, parentId: replyTo?.id ?? null }).then((next) => {
          setComments(next.comments);
          setDraft("");
          setReplyTo(null);
        });
      }}
      onOpenAuthor={onOpenAuthor}
      inputRef={inputRef}
    />,
    document.querySelector(".app-root") ?? document.body,
  );
}

export function FeedPlacePost({ card, now, onOpenPlace, onOpenPost, onToggleLike, onShowOnMap, onStatus, onSlots, onGather, onOpenUser, userId = null }: FeedPlacePostProps & { onShowOnMap?: () => void }) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const travel = formatFeedTravel(card.travelMinutes, card.distanceKm);
  const rating = formatFeedRating(card.rating);
  const price = formatPricePerHour(card.pricePerHourRub);
  const friends = feedGoingFriendsLine(card.goingFriends);
  const quote = card.quote;
  return (
    <article className="app-feed-post app-feed-post--place">
      <header className="app-feed-post-head">
        <span className="app-feed-place-avatar" aria-hidden="true">
          {card.place.title.charAt(0)}
        </span>
        <span className="app-feed-post-id">
          <span className="app-feed-place-name">
            <button type="button" className="app-feed-place-name-btn" onClick={() => onOpenPlace(card.place.id)}>
              {card.place.title}
            </button>
            {card.verified && (
              <span className="app-feed-verified" aria-label="Проверенная площадка">
                <ActionIcon name="check" size={14} strokeWidth={2.4} />
              </span>
            )}
          </span>
          {onShowOnMap ? (
            <button type="button" className="app-feed-place-where" onClick={onShowOnMap}>
              <ActionIcon name="pin" size={12} />
              {card.place.address}
              {travel !== null && <span className="app-feed-travel">{travel}</span>}
            </button>
          ) : (
            <span className="app-feed-place-where">
              <ActionIcon name="pin" size={12} />
              {card.place.address}
              {travel !== null && <span className="app-feed-travel">{travel}</span>}
            </span>
          )}
        </span>
        {rating !== null && (
          <span className="app-feed-rating" aria-label={`Рейтинг ${rating}`}>
            <ActionIcon name="star" size={13} />
            {rating}
          </span>
        )}
      </header>
      <div className="app-feed-hero app-feed-hero--place">
        <button type="button" className="app-feed-hero-hit" aria-label={card.title} onClick={onOpenPost}>
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
        </button>
        <span className="app-feed-hero-foot">
          {friends !== null &&
            (onOpenUser ? (
              <button type="button" className="app-feed-hero-pill" aria-label={`Профиль ${card.goingFriends[0].name}`} onClick={() => onOpenUser(card.goingFriends[0].id)}>
                <span className="app-feed-faces" aria-hidden="true">
                  {card.goingFriends.slice(0, 2).map((friend) => (
                    <span key={friend.id} className="app-feed-face">
                      {friend.name.charAt(0)}
                    </span>
                  ))}
                </span>
                {friends}
              </button>
            ) : (
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
            ))}
          {price !== null && <span className="app-feed-hero-pill app-feed-hero-pill--price">{price}</span>}
        </span>
      </div>
      <div className="app-feed-actions">
        <button type="button" className="app-post-action" aria-pressed={card.likedByMe} aria-label="Нравится" onClick={onToggleLike ?? onOpenPost}>
          <ActionIcon filled={card.likedByMe} name="heart" size={26} />
          <span>{card.likesCount}</span>
        </button>
        <button type="button" className="app-post-action" aria-label="Комментарии" onClick={() => setCommentsOpen(true)}>
          <ActionIcon name="comment" size={26} />
          <span>{card.commentsCount}</span>
        </button>
        <button
          type="button"
          className="app-post-action"
          aria-label="Отправить друзьям в MAX"
          onClick={() => {
            const payload = sharePayload(card.place.title, `place-${card.place.id}`);
            void shareResult(getWebApp(), payload.text, payload.link);
          }}
        >
          <ActionIcon name="share" size={26} />
        </button>
      </div>
      <h3 className="app-feed-place-title">{card.title}</h3>
      <p className="app-feed-place-text">{card.text}</p>
      {quote !== null && (
        <blockquote className="app-feed-quote">
          {onOpenUser ? (
            <button type="button" className="app-feed-quote-author" aria-label={`Профиль ${quote.author.name}`} onClick={() => onOpenUser(quote.author.id)}>
              {firstName(quote.author.name)}:
            </button>
          ) : (
            <span className="app-feed-quote-author">{firstName(quote.author.name)}:</span>
          )}{" "}
          <span className="app-feed-quote-text">«{quote.text}»</span>
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
      {commentsOpen && <PlaceComments postId={card.id} userId={userId} onClose={() => setCommentsOpen(false)} onOpenAuthor={onOpenUser} />}
    </article>
  );
}

export interface FeedCardHandlers {
  onOpenPlace: (placeId: string) => void;
  onOpenPlaceMap?: (card: FeedPlaceCard) => void;
  onOpenPost: (postId: string) => void;
  onOpenEvent: (eventId: string) => void;
  onOpenAuthor: (userId: string) => void;
  onOpenMark?: (card: FeedFriendCard) => void;
  userId: string | null;
  onToggleLike: (card: FeedFriendCard) => void;
  onToggleGoing: (card: FeedFriendCard) => void;
  onOpenComments: (card: FeedFriendCard) => void;
  onShare: (card: FeedFriendCard) => void;
  onPlaceLike: (card: FeedPlaceCard) => void;
  onPlaceStatus: (card: FeedPlaceCard, status: ParticipationStatus) => void;
  onSlots: (card: FeedPlaceCard) => void;
  onGather: (card: FeedPlaceCard) => void;
  onDelete?: (card: FeedFriendCard) => void;
}

class FeedCardBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    console.error("feed card crashed", error.message);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function FeedCardList({ cards, now, handlers, storyAuthors }: { cards: FeedCard[]; now: Date; handlers: FeedCardHandlers; storyAuthors?: ReadonlySet<string> }) {
  return (
    <div className="app-feed-posts">
      {cards.map((card) => (
        <FeedCardBoundary key={card.id}>
          {card.kind === "friend" ? (
            <FeedFriendPost
              card={card}
              now={now}
              onToggleLike={() => handlers.onToggleLike(card)}
              onToggleGoing={() => handlers.onToggleGoing(card)}
              onOpenComments={() => handlers.onOpenComments(card)}
              onShare={() => handlers.onShare(card)}
              onOpenPerson={handlers.onOpenAuthor}
              onOpenEvent={() => {
                if (card.event) handlers.onOpenEvent(card.event.id);
              }}
              onOpenAuthor={() => handlers.onOpenAuthor(card.author.id)}
              onOpenMark={handlers.onOpenMark ? () => handlers.onOpenMark?.(card) : undefined}
              userId={handlers.userId}
              hasStory={storyAuthors?.has(card.author.id) === true}
            />
          ) : (
            <FeedPlacePost card={card} now={now} userId={handlers.userId} onOpenPlace={handlers.onOpenPlace} onOpenPost={() => handlers.onOpenPost(card.id)} onToggleLike={() => handlers.onPlaceLike(card)} onShowOnMap={handlers.onOpenPlaceMap ? () => handlers.onOpenPlaceMap?.(card) : undefined} onStatus={(status) => handlers.onPlaceStatus(card, status)} onSlots={() => handlers.onSlots(card)} onGather={() => handlers.onGather(card)} onOpenUser={handlers.onOpenAuthor} />
          )}
        </FeedCardBoundary>
      ))}
    </div>
  );
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

function feedDateBadge(startsAt: string): { month: string; day: string } {
  const date = new Date(startsAt);
  return { month: date.toLocaleDateString("ru-RU", { month: "short" }).replace(".", "").slice(0, 3).toUpperCase(), day: date.toLocaleDateString("ru-RU", { day: "numeric" }) };
}

/** «12 из 30» — сколько мест уже занято. Без вместимости строка не появляется. */
function eventFill(event: Event): string | null {
  if (event.capacity == null) return null;
  const booked = event.bookedCount ?? (event.remainingSeats != null ? Math.max(0, event.capacity - event.remainingSeats) : null);
  if (booked == null) return null;
  return `${booked} из ${event.capacity}`;
}

/** The social feed can be empty. The city still has events, and they should look like photographs. */
function FeedCityPhotos({ onOpen, onCreate }: { onOpen: (id: string) => void; onCreate: () => void }) {
  const [events, setEvents] = useState<Event[] | null>(null);
  const [likes, setLikes] = useState<Record<string, true>>({});
  useEffect(() => {
    let alive = true;
    apiClient.listEvents().then(
      (list) => {
        if (alive) setEvents(list.slice(0, 6));
      },
      () => {
        if (alive) setEvents([]);
      },
    );
    return () => {
      alive = false;
    };
  }, []);
  if (events === null) return <AppState>Собираем афишу…</AppState>;
  if (events.length === 0) return <AppEmptyState kind="empty-feed" onAction={onCreate} />;
  return (
    <div className="app-feed-city">
      <div className="app-feed-city-head">
        <h2 className="app-screen-title">События</h2>
      </div>
      <div className="app-feed-city-grid">
        {events.map((event) => {
          const badge = feedDateBadge(event.startsAt);
          const fill = eventFill(event);
          const liked = likes[event.id] === true;
          const going = event.friendsGoing?.length ?? 0;
          return (
            <article key={event.id} className="app-feed-city-item">
              <button type="button" className="app-feed-city-card" onClick={() => onOpen(event.id)}>
                <img alt="" src={pictured(event.id, event.coverUrl)} />
                <span className="app-feed-city-date">
                  <span>{badge.month}</span>
                  <b>{badge.day}</b>
                </span>
                <span className="app-feed-city-veil">
                  <span className="app-feed-city-kicker">Событие</span>
                  <span className="app-feed-city-title">{event.title}</span>
                  <span className="app-feed-city-meta">{fill === null ? event.city : `${event.city} · занято ${fill}`}</span>
                  {going > 0 && (
                    <span className="app-feed-city-meta">
                      {going} {pluralRu(going, "человек идёт", "человека идут", "человек идут")}
                    </span>
                  )}
                </span>
              </button>
              <div className="app-feed-city-actions">
                <button
                  type="button"
                  className="app-post-action"
                  aria-pressed={liked}
                  aria-label="Нравится"
                  onClick={() =>
                    setLikes((current) => {
                      const next = { ...current };
                      if (next[event.id]) delete next[event.id];
                      else next[event.id] = true;
                      return next;
                    })
                  }
                >
                  <ActionIcon filled={liked} name="heart" size={22} />
                  <span>{going + (liked ? 1 : 0)}</span>
                </button>
                <button
                  type="button"
                  className="app-post-action"
                  aria-label="Отправить друзьям в MAX"
                  onClick={() => {
                    const payload = sharePayload(event.title, `event-${event.id}`);
                    void shareResult(getWebApp(), payload.text, payload.link);
                  }}
                >
                  <ActionIcon name="share" size={22} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

/** Cards from the last visit, so coming back from a post does not collapse the feed to a skeleton and lose the scroll. */
let feedMemory: FeedCard[] | null = null;

export function FeedScreen() {
  const auth = useAuth();
  const userId = auth.status === "authenticated" ? auth.user.id : null;
  const { navigate } = useRoute();
  const [state, setState] = useState<FeedScreenState>(() => (feedMemory === null ? { status: "loading" } : { status: "ready", cards: feedMemory }));
  const [storyAuthors, setStoryAuthors] = useState<Set<string>>(new Set());
  const now = new Date();

  const fetchCards = useCallback(
    (initial: boolean) => {
      if (auth.status === "loading") return;
      if (initial && feedMemory === null) setState({ status: "loading" });
      let alive = true;
      const timer = window.setTimeout(() => {
        if (!alive) return;
        setState((current) => {
          if (current.status !== "loading") return current;
          return feedMemory === null ? { status: "error" } : { status: "ready", cards: feedMemory };
        });
      }, 8000);
      apiClient.listFeedCards(userId ?? "").then(
        (cards) => {
          if (!alive) return;
          feedMemory = cards;
          setState({ status: "ready", cards });
        },
        // A failed refresh after a write must not blank a feed that is already on screen.
        (error: unknown) => {
          console.error("feed cards failed", error);
          if (!alive) return;
          setState((current) => (initial && feedMemory === null ? { status: "error" } : current));
        },
      );
      return () => {
        alive = false;
        window.clearTimeout(timer);
      };
    },
    [userId, auth.status],
  );

  useEffect(() => {
    if (auth.status === "loading") return;
    return fetchCards(true);
  }, [fetchCards, auth.status]);

  useLayoutEffect(() => {
    if (state.status !== "ready") return;
    const top = savedScroll("home");
    const el = document.querySelector(".app-content");
    if (top === undefined || !(el instanceof HTMLElement)) return;
    let stop = false;
    let applies = 0;
    let observer: ResizeObserver | null = null;
    const halt = () => {
      stop = true;
      observer?.disconnect();
    };
    const apply = () => {
      if (stop) return;
      applies += 1;
      if (applies > 20) {
        halt();
        return;
      }
      const room = el.scrollHeight - el.clientHeight;
      if (room + 8 < top) return;
      el.scrollTop = top;
      if (Math.abs(el.scrollTop - top) < 2) halt();
    };
    apply();
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        window.requestAnimationFrame(apply);
      });
      try {
        observer.observe(el);
      } catch {
        halt();
      }
    }
    const later = window.setTimeout(halt, 1500);
    return () => {
      halt();
      window.clearTimeout(later);
    };
  }, [state.status]);

  useEffect(() => {
    apiClient.listStories().then(
      (stories) => setStoryAuthors(new Set(stories.map((story) => story.userId))),
      () => {},
    );
  }, []);

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
    onOpenPlace: (placeId) => navigate({ name: "place", id: placeId }),
    onOpenPost: (postId) => {
      const scroller = document.querySelector(".app-content");
      if (scroller instanceof HTMLElement) freezeScroll("home", scroller.scrollTop);
      navigate({ name: "post", id: postId });
    },
    onOpenEvent: (eventId) => navigate({ name: "event", id: eventId }),
    onOpenAuthor: (id) => navigate({ name: "user", id }),
    onOpenMark: (card) => {
      const pin = parsePinLabel(card.locationLabel ?? card.placeTitle ?? "");
      if (pin) navigate({ name: "map", pin });
      else if (card.event?.placeId) navigate({ name: "map", placeId: card.event.placeId });
    },
    onOpenPlaceMap: (card) => navigate({ name: "map", pin: { lat: card.place.latitude, lng: card.place.longitude }, placeId: card.place.id }),
    userId,
    onToggleLike: (card) => {
      if (userId === null) return;
      void settle(apiClient.toggleFeedLike(card.id, userId));
    },
    onToggleGoing: (card) => {
      if (userId === null) return;
      if (card.event === null) return;
      void settle(apiClient.toggleFeedGoing(card.id, userId));
    },
    onOpenComments: () => {},
    onShare: (card) => {
      const sentence = card.event ? `${card.author.name} — ${card.event.title}: ${card.text}` : `${card.author.name}: ${card.text}`;
      const payload = sharePayload(sentence, card.event ? `event-${card.event.id}` : `post-${card.id}`);
      void shareResult(getWebApp(), payload.text, payload.link).then(announceShare);
    },
    onPlaceLike: (card) => {
      if (userId === null) return;
      void settle(apiClient.toggleFeedLike(card.id, userId));
    },
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
      <FeedCardBoundary>
        <StoriesRow />
      </FeedCardBoundary>
      <FeedWhereToCard onStart={() => navigate({ name: "whereto" })} />
      {state.status === "error" ? (
        <AppState error action={{ label: "Повторить", onClick: () => fetchCards(true) }}>
          Не удалось загрузить ленту.
        </AppState>
      ) : state.cards.length === 0 ? (
        <FeedCityPhotos onOpen={(id) => navigate({ name: "event", id })} onCreate={() => navigate({ name: "create" })} />
      ) : (
        <FeedCardList cards={state.cards} now={now} handlers={handlers} storyAuthors={storyAuthors} />
      )}
    </section>
  );
}
