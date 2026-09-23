// START_MODULE_CONTRACT
// PURPOSE: Feed and stories endpoints of the api client: the stories rail, the home feed cards (макет, экран 03), the impression wall with its likes and comments, and the two publication screens (макет, экраны 05 и 06).
// SCOPE: GET/POST /stories, GET /feed/cards, GET /notifications/summary, GET/POST /feed, POST /feed/drafts, POST /feed/:id/like, POST /feed/:id/comments; the FeedCard aggregate is a client-side shape like EventDetails in ./catalog.ts.
// DEPENDS: ./transport.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - FeedPost - impression post aggregate: author, event, text, like counter/state, comments
// - FeedComment - post comment attributed to its author
// - CreateFeedPost - impression publication payload (author, event, text, optional photo); the userId field is a mock-only convenience ignored by the real backend (identity comes from the init-data token)
// - StoryAudience - who a published story is shown to (макет, экран 05); no such column on the backend (#502)
// - STORY_AUDIENCES - the story audiences in design order, «Близкие друзья» first
// - StoryPlaceSticker - place sticker of a story: what it is about, the venue line under it and the free seats (макет, экран 05)
// - StoryPoll - the poll drawn on a story: one question, its options and the highlighted answer (макет, экран 05)
// - StoryComposition - everything a composed story carries beyond its image; POST /stories takes only imageUrl today and strips the rest (#502)
// - PostAudience - who a published post is shown to (макет, экран 06): friends / city / the company only
// - POST_AUDIENCES - the post audiences in design order, «Друзья» first
// - PostDraft - the автосохранение payload of the post composer (макет, экран 06); no draft table exists (#502)
// - PostDraftSaved - when the draft was last stored, the «Черновик сохранён» line reads it
// - FeedCardCounts - social counters of one feed card (wants to go / going / waitlist / free seats); every field is nullable because the list DTO does not carry them yet (#496)
// - FeedFriendCard - friend post of the home feed: the author, the event hero with its live/hit badges, the counters, the caption and the comments
// - FeedPlaceCard - venue post of the home feed: the place header with rating and travel time, the slot offer, the friend quote and the viewer status block
// - FeedCard - discriminated union of the two home feed card kinds
// - NotificationsSummary - unread count behind the header bell; mock-only until the notifications domain exists (#494)
// - withFeed - ApiClient.listStories / createStory / listFeedCards / getNotificationsSummary / listFeedPosts / createFeedPost / savePostDraft / toggleFeedLike / addFeedComment
// END_MODULE_MAP

import { EventSchema, FeedCommentSchema, FeedPostSchema, FriendSchema, ParticipationStatusSchema, PlaceSchema, StorySchema } from "@max-events/api-contracts";
import type { Event, FeedComment as ContractFeedComment, FeedPost as ContractFeedPost, Friend, ParticipationStatus, Place, Story } from "@max-events/api-contracts";
import type { ApiMixin, ZodSchema } from "./transport";

/** Feed comment attributed to its author. */
export type FeedComment = ContractFeedComment;

/** Impression post aggregate: author, event, text, like counter/state and comments; the photo is a CSS placeholder. */
export type FeedPost = ContractFeedPost;

/**
 * Impression publication payload: the author, the event the post is about and the text.
 *
 * Everything below photoUrl is the publication screen of the design (макет, экран 06) and has no
 * column behind it: the place, the tagged friends, the audience, «разрешить запись через пост» and
 * the second and third photo of the grid are all #502 (photos additionally wait for object storage,
 * #477). They travel in the body under the names the future endpoint will take — the controller
 * parses with a non-strict zod object, so today the server simply strips them and publishes the post.
 */
export interface CreateFeedPost {
  userId: string;
  eventId: string;
  text: string;
  /** Optional photo for the post; the server stores the url as given. */
  photoUrl?: string | null;
  /** Every picked photo, newest grid last; only photoUrls[0] survives the trip today (#502, #477). */
  photoUrls?: string[];
  /** Where the post was made from; null when the author removed the place row. */
  placeId?: string | null;
  /** «Отметить друзей · Анна, Дима» (#502). */
  taggedFriendIds?: string[];
  /** «Кто увидит» (#502). */
  audience?: PostAudience;
  /** «Разрешить запись через пост» (#502). */
  allowJoin?: boolean;
}

/** Who a published story is shown to (макет, экран 05). The story table has no audience column (#502). */
export type StoryAudience = "close-friends" | "friends" | "city";

/** Design order: the story composer opens on «Близкие друзья», the label the макет prints on the button. */
export const STORY_AUDIENCES: ReadonlyArray<{ id: StoryAudience; label: string }> = [
  { id: "close-friends", label: "Близкие друзья" },
  { id: "friends", label: "Друзья" },
  { id: "city", label: "Город" },
];

/** Place sticker of a story (макет, экран 05): «Мангальная зона» / «Парк Горького · 14:00» / «осталось мест 4». */
export interface StoryPlaceSticker {
  eventId: string;
  title: string;
  subtitle: string;
  /** Free seats of the event; null when it has no capacity to count against. */
  seatsLeft: number | null;
}

/** The poll drawn on a story (макет, экран 05). Votes on a story are not a domain at all (#502). */
export interface StoryPoll {
  question: string;
  options: string[];
  /** Index of the option the author highlighted; null while none is. */
  answer: number | null;
}

/**
 * What a composed story carries beyond its image (макет, экран 05). POST /stories declares its body
 * inline in the controller — `z.object({ imageUrl })`, not a schema in @max-events/api-contracts —
 * and being non-strict it strips these fields instead of refusing them, so the story still publishes
 * and the sticker, the poll and the audience arrive once #502 lands.
 */
export interface StoryComposition {
  /** The caption drawn over the story. */
  text: string;
  sticker: StoryPlaceSticker | null;
  poll: StoryPoll | null;
  audience: StoryAudience;
}

/** Who a published post is shown to (макет, экран 06); no audience column behind it (#502). */
export type PostAudience = "friends" | "city" | "company";

/** Design order of the «Кто увидит» chips, «Друзья» selected first. */
export const POST_AUDIENCES: ReadonlyArray<{ id: PostAudience; label: string }> = [
  { id: "friends", label: "Друзья" },
  { id: "city", label: "Город" },
  { id: "company", label: "Только компания" },
];

/** What the post composer autosaves (макет, экран 06, «Черновик сохранён»); there is no draft table (#502). */
export interface PostDraft {
  userId: string;
  /** Null while no event is bound: a draft is savable long before it is publishable. */
  eventId: string | null;
  text: string;
  photoUrls: string[];
  placeId: string | null;
  taggedFriendIds: string[];
  audience: PostAudience;
  allowJoin: boolean;
}

export interface PostDraftSaved {
  /** ISO stamp of the save the «Черновик сохранён» line reports. */
  savedAt: string;
}

/**
 * Social counters of one feed card. Every field is nullable on purpose: the list DTO of the feed
 * carries none of them today (#496), so a card that cannot count says so instead of showing a zero
 * the reader would take for an answer.
 */
export interface FeedCardCounts {
  /** «12 хотят пойти» — participation wants_to_go. */
  wantsToGo: number | null;
  /** «4 уже там» / «16 идут» — participation going. */
  going: number | null;
  /** «7 в листе ожидания» — the waitlist of a sold-out event. */
  waitlist: number | null;
  /** «12 мест свободно» — capacity minus bookings; no bookedCount in the list DTO (#496). */
  freeSeats: number | null;
}

/** Friend post of the home feed (макет, экран 03): what a friend wrote about an event they are going to. */
export interface FeedFriendCard {
  kind: "friend";
  id: string;
  author: Friend;
  /** Where the post was made from; null for an event without a place. */
  placeTitle: string | null;
  /** Distance from the viewer to the event, km; null until the list DTO carries it (#496). */
  distanceKm: number | null;
  event: Event;
  /** The event is running right now — the cyan «Сейчас идёт» chip. */
  live: boolean;
  /** «ХИТ НЕДЕЛИ»: the events domain has no such flag yet (#496). */
  hit: boolean;
  counts: FeedCardCounts;
  /** Viewer participation on the event; drives the «Пойду» button. */
  myStatus: ParticipationStatus | null;
  text: string;
  likesCount: number;
  likedByMe: boolean;
  /** The comments shown under the post; commentsCount is the full number. */
  comments: ContractFeedComment[];
  commentsCount: number;
  publishedAt: string;
}

/** Venue post of the home feed (макет, экран 03): a place posting its own offer, with the viewer status block. */
export interface FeedPlaceCard {
  kind: "place";
  id: string;
  place: Place;
  /** Venue account confirmed by moderation; no such flag on the place yet (#496). */
  verified: boolean;
  /** Distance from the viewer, km; null until the list DTO carries it (#496). */
  distanceKm: number | null;
  /** Walking minutes from the viewer; same gap as distanceKm (#496). */
  travelMinutes: number | null;
  /** Average stars of the venue; only a separate request answers it today (#496). */
  rating: number | null;
  /** «800 ₽/час»: the slot domain does not exist yet (#492). */
  pricePerHourRub: number | null;
  /** «Свободно сегодня с 14:00»: the slot domain does not exist yet (#492). */
  slotLabel: string | null;
  /** What the venue offers, shown as the hero chip («Мангальная зона»). */
  offerLabel: string | null;
  /** Friends going there — the hero pill «Идёт Анна +1». */
  goingFriends: Friend[];
  title: string;
  text: string;
  /** A friend's line about the venue; null when no friend wrote one. */
  quote: { author: Friend; text: string } | null;
  likesCount: number;
  likedByMe: boolean;
  commentsCount: number;
  /** Viewer status on the venue; the slot domain owns it (#492). */
  myStatus: ParticipationStatus | null;
  publishedAt: string;
}

export type FeedCard = FeedFriendCard | FeedPlaceCard;

/**
 * What the bell in the feed header counts (макет, экран 03). Notifications are not a domain yet —
 * smart-alerts is a scheduler, not an inbox (#494) — so this is the shape and the path that endpoint
 * will take; it lives here because the header it feeds belongs to the feed screen, and moves to its
 * own module once the domain exists.
 */
export interface NotificationsSummary {
  unreadCount: number;
}

const NotificationsSummarySchema: ZodSchema<NotificationsSummary> = {
  safeParse(data: unknown) {
    if (typeof data !== "object" || data === null) return { success: false as const, error: "expected a notifications summary object" };
    const raw = data as Record<string, unknown>;
    if (typeof raw.unreadCount !== "number") return { success: false as const, error: "invalid notifications summary" };
    return { success: true as const, data: { unreadCount: raw.unreadCount } };
  },
};

const PostDraftSavedSchema: ZodSchema<PostDraftSaved> = {
  safeParse(data: unknown) {
    if (typeof data !== "object" || data === null) return { success: false as const, error: "expected a draft receipt object" };
    const raw = data as Record<string, unknown>;
    if (typeof raw.savedAt !== "string") return { success: false as const, error: "invalid draft receipt" };
    return { success: true as const, data: { savedAt: raw.savedAt } };
  },
};

const isNullableNumber = (value: unknown): value is number | null => value === null || typeof value === "number";

const isNullableString = (value: unknown): value is string | null => value === null || typeof value === "string";

function parseCounts(raw: unknown): FeedCardCounts | null {
  if (typeof raw !== "object" || raw === null) return null;
  const counts = raw as Record<string, unknown>;
  if (!isNullableNumber(counts.wantsToGo) || !isNullableNumber(counts.going) || !isNullableNumber(counts.waitlist) || !isNullableNumber(counts.freeSeats)) return null;
  return { wantsToGo: counts.wantsToGo, going: counts.going, waitlist: counts.waitlist, freeSeats: counts.freeSeats };
}

function parseStatus(raw: unknown): { ok: true; value: ParticipationStatus | null } | { ok: false } {
  if (raw === null) return { ok: true, value: null };
  const parsed = ParticipationStatusSchema.safeParse(raw);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false };
}

function parseFriendCard(raw: Record<string, unknown>): FeedFriendCard | null {
  const author = FriendSchema.safeParse(raw.author);
  const event = EventSchema.safeParse(raw.event);
  const comments = FeedCommentSchema.array().safeParse(raw.comments);
  const myStatus = parseStatus(raw.myStatus);
  const counts = parseCounts(raw.counts);
  if (!author.success || !event.success || !comments.success || !myStatus.ok || counts === null) return null;
  if (typeof raw.id !== "string" || typeof raw.text !== "string" || typeof raw.publishedAt !== "string") return null;
  if (typeof raw.likesCount !== "number" || typeof raw.likedByMe !== "boolean" || typeof raw.commentsCount !== "number") return null;
  if (typeof raw.live !== "boolean" || typeof raw.hit !== "boolean" || !isNullableString(raw.placeTitle) || !isNullableNumber(raw.distanceKm)) return null;
  return { kind: "friend", id: raw.id, author: author.data, placeTitle: raw.placeTitle, distanceKm: raw.distanceKm, event: event.data, live: raw.live, hit: raw.hit, counts, myStatus: myStatus.value, text: raw.text, likesCount: raw.likesCount, likedByMe: raw.likedByMe, comments: comments.data, commentsCount: raw.commentsCount, publishedAt: raw.publishedAt };
}

function parseQuote(raw: unknown): { ok: true; value: FeedPlaceCard["quote"] } | { ok: false } {
  if (raw === null) return { ok: true, value: null };
  if (typeof raw !== "object") return { ok: false };
  const quote = raw as Record<string, unknown>;
  const author = FriendSchema.safeParse(quote.author);
  if (!author.success || typeof quote.text !== "string") return { ok: false };
  return { ok: true, value: { author: author.data, text: quote.text } };
}

function parsePlaceCard(raw: Record<string, unknown>): FeedPlaceCard | null {
  const place = PlaceSchema.safeParse(raw.place);
  const goingFriends = FriendSchema.array().safeParse(raw.goingFriends);
  const quote = parseQuote(raw.quote);
  const myStatus = parseStatus(raw.myStatus);
  if (!place.success || !goingFriends.success || !quote.ok || !myStatus.ok) return null;
  if (typeof raw.id !== "string" || typeof raw.title !== "string" || typeof raw.text !== "string" || typeof raw.publishedAt !== "string") return null;
  if (typeof raw.likesCount !== "number" || typeof raw.likedByMe !== "boolean" || typeof raw.commentsCount !== "number" || typeof raw.verified !== "boolean") return null;
  if (!isNullableNumber(raw.distanceKm) || !isNullableNumber(raw.travelMinutes) || !isNullableNumber(raw.rating) || !isNullableNumber(raw.pricePerHourRub)) return null;
  if (!isNullableString(raw.slotLabel) || !isNullableString(raw.offerLabel)) return null;
  return { kind: "place", id: raw.id, place: place.data, verified: raw.verified, distanceKm: raw.distanceKm, travelMinutes: raw.travelMinutes, rating: raw.rating, pricePerHourRub: raw.pricePerHourRub, slotLabel: raw.slotLabel, offerLabel: raw.offerLabel, goingFriends: goingFriends.data, title: raw.title, text: raw.text, quote: quote.value, likesCount: raw.likesCount, likedByMe: raw.likedByMe, commentsCount: raw.commentsCount, myStatus: myStatus.value, publishedAt: raw.publishedAt };
}

const FeedCardsSchema: ZodSchema<FeedCard[]> = {
  safeParse(data: unknown) {
    if (!Array.isArray(data)) return { success: false as const, error: "expected a feed card array" };
    const cards: FeedCard[] = [];
    for (const item of data) {
      if (typeof item !== "object" || item === null) return { success: false as const, error: "invalid feed card" };
      const raw = item as Record<string, unknown>;
      const card = raw.kind === "friend" ? parseFriendCard(raw) : raw.kind === "place" ? parsePlaceCard(raw) : null;
      if (card === null) return { success: false as const, error: "invalid feed card" };
      cards.push(card);
    }
    return { success: true as const, data: cards };
  },
};

export function withFeed<TBase extends ApiMixin>(Base: TBase) {
  return class FeedEndpoints extends Base {
    listStories(): Promise<Story[]> {
      return this.request("/stories", StorySchema.array());
    }

    /**
     * Publishes a story. Without a composition the body is exactly what the backend takes today;
     * with one it also carries the caption, the place sticker, the poll and the audience of макет,
     * экран 05 under the names the endpoint will keep (#502) — the controller strips them for now.
     */
    createStory(imageUrl: string, composition?: StoryComposition): Promise<Story> {
      return this.request("/stories", StorySchema, { body: composition === undefined ? { imageUrl } : { imageUrl, ...composition } });
    }

    /**
     * Home feed cards (макет, экран 03). A separate endpoint from /feed on purpose: a card carries
     * the event hero, the social counters and the venue offer the wall posts never needed, and the
     * backend gaps behind them (#496 distance/rating/counters/hit, #492 slots) land here, not in
     * the impression post DTO. The userId param is a mock-only convenience, as elsewhere.
     */
    listFeedCards(userId: string): Promise<FeedCard[]> {
      return this.request(`/feed/cards?userId=${encodeURIComponent(userId)}`, FeedCardsSchema);
    }

    /** Unread count behind the header bell; mock-only until the notifications domain lands (#494). */
    getNotificationsSummary(userId: string): Promise<NotificationsSummary> {
      return this.request(`/notifications/summary?userId=${encodeURIComponent(userId)}`, NotificationsSummarySchema);
    }

    listFeedPosts(eventId?: string, placeId?: string): Promise<FeedPost[]> {
      const query = eventId !== undefined ? `?eventId=${encodeURIComponent(eventId)}` : placeId !== undefined ? `?placeId=${encodeURIComponent(placeId)}` : "";
      return this.request(`/feed${query}`, FeedPostSchema.array());
    }

    createFeedPost(payload: CreateFeedPost): Promise<FeedPost> {
      return this.request("/feed", FeedPostSchema, { body: payload });
    }

    /**
     * Autosaves the post draft behind the «Черновик сохранён» line (макет, экран 06). Drafts are not
     * a domain — nothing on the backend answers this path yet, the mock does — so this is the shape
     * and the path that endpoint will take (#502), same arrangement as /notifications/summary (#494).
     */
    savePostDraft(draft: PostDraft): Promise<PostDraftSaved> {
      return this.request("/feed/drafts", PostDraftSavedSchema, { body: draft });
    }

    /** Toggle a feed like; the userId param is ignored server-side, identity comes from initData. */
    toggleFeedLike(postId: string, userId: string): Promise<FeedPost> {
      return this.request(`/feed/${postId}/like?userId=${encodeURIComponent(userId)}`, FeedPostSchema, { method: "POST" });
    }

    addFeedComment(postId: string, payload: { userId: string; text: string }): Promise<FeedPost> {
      return this.request(`/feed/${postId}/comments`, FeedPostSchema, { body: payload });
    }
  };
}
