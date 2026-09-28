// START_MODULE_CONTRACT
// PURPOSE: Feed and stories endpoints of the api client: the stories rail, the home feed cards (макет, экран 03), the impression wall with its likes and comments, and the two publication screens (макет, экраны 05 и 06).
// SCOPE: GET/POST /stories, GET /feed/cards, GET/POST /feed, GET /feed/:id, POST /feed/drafts, POST /feed/:id/like, POST /feed/:id/comments, plus GET /events and GET /places read as the fallback behind GET /feed/cards; the FeedCard aggregate is a client-side shape like EventDetails in ./catalog.ts. The header bell of экран 03 moved out with its screen: the inbox and its unread count live in ./notifications.ts.
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
// - StoryObjectKind - what an author can put on the story canvas: caption, event sticker, poll, free-seats counter (макет, экран 05)
// - StoryCanvasObject - canvas object persisted on POST /stories and returned by GET /stories
// - PostAudience - who a published post is shown to (макет, экран 06): friends / city / the company only
// - POST_AUDIENCES - the post audiences in design order, «Друзья» first
// - PostDraft - the автосохранение payload of the post composer (макет, экран 06); no draft table exists (#502)
// - PostDraftSaved - when the draft was last stored, the «Черновик сохранён» line reads it
// - FeedCardCounts - social counters of one feed card (wants to go / going / waitlist / free seats); every field is nullable because the list DTO does not carry them yet (#496)
// - FeedFriendCard - friend post of the home feed: the author, the event hero with its live/hit badges, the counters, the caption and the comments
// - FeedPlaceCard - venue post of the home feed: the place header with rating and travel time, the slot offer, the friend quote and the viewer status block
// - FeedCard - discriminated union of the two home feed card kinds
// - feedCardsFromPosts - home feed cards built out of GET /feed + GET /events + GET /places, for a server that does not answer GET /feed/cards yet
// - withFeed - ApiClient.listStories / createStory / listFeedCards / listFeedPosts / getFeedPost / createFeedPost / savePostDraft / toggleFeedLike / addFeedComment
// END_MODULE_MAP

import { EventSchema, FeedCommentSchema, FeedPostSchema, FriendSchema, ParticipationStatusSchema, PlaceSchema, StorySchema } from "@max-events/api-contracts";
import type { Event, FeedComment as ContractFeedComment, FeedPost as ContractFeedPost, Friend, ParticipationStatus, Place, Story } from "@max-events/api-contracts";
import { isEndpointMissing } from "./transport";
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
  eventId: string | null;
  text: string;
  /** Optional photo for the post; the server stores the url as given. */
  photoUrl?: string | null;
  /** Every picked photo, up to three. The first is also photoUrl. */
  photoUrls?: string[];
  /** Where the post was made from; null when the author removed the place row. */
  placeId?: string | null;
  locationLabel?: string | null;
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
  /** Event cover. Absent on stories published before the sticker carried a photo. */
  coverUrl?: string | null;
  /** Event start, so the seat count can hide once the event is over. */
  startsAt?: string;
}

/** The poll drawn on a story (макет, экран 05). Votes on a story are not a domain at all (#502). */
export interface StoryPoll {
  question: string;
  options: string[];
  /** Index of the option the author highlighted; null while none is. */
  answer: number | null;
  /** Votes per option, filled in after someone answers. A draft the author is still writing leaves this out. */
  counts?: number[];
}

/**
 * What a composed story carries beyond its image (макет, экран 05). POST /stories declares its body
 * inline in the controller — `z.object({ imageUrl })`, not a schema in @max-events/api-contracts —
 * and being non-strict it strips these fields instead of refusing them, so the story still publishes
 * and the sticker, the poll and the audience arrive once #502 lands.
 */
export interface StoryComposition {
  /** The caption drawn over the story; empty when the author never put a text object on the canvas. */
  text: string;
  sticker: StoryPlaceSticker | null;
  poll: StoryPoll | null;
  audience: StoryAudience;
  /** What the author put on the canvas and where, in the order they added it; absent for a story of one background (#502). */
  objects?: StoryCanvasObject[];
}

/** What an author can put on the story canvas (макет, экран 05): a caption, the event sticker, a poll, the free-seats counter. */
export type StoryObjectKind = "text" | "event" | "poll" | "seats";

/**
 * One object of the story canvas and where it sits. The position is a percentage of the frame, not
 * pixels: the frame is as tall as the phone, and a story composed on one screen has to read the same
 * on every other. Nothing on the backend holds it yet (#502).
 */
export interface StoryCanvasObject {
  /** Set on every text after the first, so several captions can share one story. */
  id?: string;
  kind: StoryObjectKind;
  x: number;
  y: number;
  /** How much bigger the author made the object; absent while it stays at its natural size. */
  scale?: number;
  /** Caption of this text object. The first caption may also live on the story's text field. */
  text?: string;
  font?: "plain" | "serif" | "mono" | "hand";
  color?: "white" | "ink" | "violet" | "cyan";
  mentionIds?: string[];
  /** @handle in this caption and the profile it opens. */
  mentions?: { id: string; handle: string }[];
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
  /** Dropped pin, "lat, lng". Null when the post only names a venue. */
  locationLabel?: string | null;
  /** Distance from the viewer to the event, km; null until the list DTO carries it (#496). */
  distanceKm: number | null;
  event: Event | null;
  /** Every photo on the post. Empty when there is none; photoUrl stays the first. */
  photoUrls?: string[];
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
  /** Friends who liked this post. The viewer is never in the list. */
  likedByFriends?: Friend[];
  /** The comments shown under the post; commentsCount is the full number. */
  comments: ContractFeedComment[];
  commentsCount: number;
  /** When the post was published; null when the card was built from a post DTO that carries no time at all (see feedCardsFromPosts). */
  publishedAt: string | null;
  /** Attached impression photo; null when the post has none. */
  photoUrl: string | null;
  /** Friends who marked «Я иду» on this post. Null when the viewer should not see that number. */
  friendsGoing?: number | null;
  /** This viewer's mark on this post. Absent on a card built before the mark existed. */
  goingByMe?: boolean;
  /** The original post, when this card is a repost. */
  repostOf?: { postId: string; author: Friend; text: string; photoUrl: string | null } | null;
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

function parsePhotoUrls(raw: unknown): string[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.some((item) => typeof item !== "string")) return null;
  return raw;
}

function parseFriendCard(raw: Record<string, unknown>): FeedFriendCard | null {
  const author = FriendSchema.safeParse(raw.author);
  const parsedEvent = raw.event === null ? null : EventSchema.safeParse(raw.event);
  const comments = FeedCommentSchema.array().safeParse(raw.comments);
  const myStatus = parseStatus(raw.myStatus);
  const counts = parseCounts(raw.counts);
  const photoUrls = parsePhotoUrls(raw.photoUrls);
  if (!author.success || parsedEvent === undefined || (parsedEvent !== null && !parsedEvent.success) || !comments.success || !myStatus.ok || counts === null || photoUrls === null) return null;
  if (typeof raw.id !== "string" || typeof raw.text !== "string" || !isNullableString(raw.publishedAt)) return null;
  if (typeof raw.likesCount !== "number" || typeof raw.likedByMe !== "boolean" || typeof raw.commentsCount !== "number") return null;
  if (typeof raw.live !== "boolean" || typeof raw.hit !== "boolean" || !isNullableString(raw.placeTitle) || !isNullableNumber(raw.distanceKm)) return null;
  const photoUrl = raw.photoUrl === undefined ? null : raw.photoUrl;
  if (!isNullableString(photoUrl)) return null;
  const locationLabel = raw.locationLabel === undefined ? null : raw.locationLabel;
  if (!isNullableString(locationLabel)) return null;
  const event = parsedEvent === null ? null : parsedEvent.data;
  const friendsGoing = raw.friendsGoing === null || typeof raw.friendsGoing === "number" ? raw.friendsGoing : undefined;
  const goingByMe = typeof raw.goingByMe === "boolean" ? raw.goingByMe : undefined;
  const likedByFriends = FriendSchema.array().safeParse(raw.likedByFriends);
  const repostOf = parseRepost(raw.repostOf);
  if (repostOf === "bad") return null;
  return { kind: "friend", id: raw.id, author: author.data, placeTitle: raw.placeTitle, locationLabel, distanceKm: raw.distanceKm, event, photoUrls, live: raw.live, hit: raw.hit, counts, myStatus: myStatus.value, text: raw.text, likesCount: raw.likesCount, likedByMe: raw.likedByMe, comments: comments.data, commentsCount: raw.commentsCount, publishedAt: raw.publishedAt, photoUrl: photoUrls[0] ?? photoUrl, friendsGoing, goingByMe, likedByFriends: likedByFriends.success ? likedByFriends.data : [], repostOf };
}

function parseRepost(raw: unknown): FeedFriendCard["repostOf"] | "bad" {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "object") return "bad";
  const repost = raw as Record<string, unknown>;
  const author = FriendSchema.safeParse(repost.author);
  if (!author.success || typeof repost.postId !== "string" || typeof repost.text !== "string") return "bad";
  const photoUrl = repost.photoUrl === null ? null : repost.photoUrl;
  if (typeof photoUrl !== "string" && photoUrl !== null) return "bad";
  return { postId: repost.postId, author: author.data, text: repost.text, photoUrl };
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

/** The event is running right now — the cyan «Сейчас идёт» chip. An event with no end has no «right now» to be inside of, so it is not claimed to be live. */
function isEventLive(event: Event, now: Date): boolean {
  if (event.endsAt === null) return false;
  const at = now.getTime();
  return Date.parse(event.startsAt) <= at && at < Date.parse(event.endsAt);
}

const NO_FEED_COUNTS: FeedCardCounts = { wantsToGo: null, going: null, waitlist: null, freeSeats: null };

/**
 * Home feed cards assembled from the endpoints a server without GET /feed/cards does have: the
 * impression wall (GET /feed), the event listing and the venue listing. Everything a card carries
 * beyond a post and its event has no source there and stays empty rather than invented — the
 * distance and the social counters are #496, the viewer status would cost one request per card, the
 * «ХИТ НЕДЕЛИ» flag is not a column, and a post DTO carries no publication time at all, so the
 * «25 минут назад» line is absent instead of reading «только что» about a week-old post. Venue cards
 * have no source of any kind (#492), so the fallback answers friend cards alone.
 */
export function feedCardsFromPosts(posts: FeedPost[], events: Event[], places: Place[], now: Date): FeedFriendCard[] {
  return posts.flatMap((post) => {
    let event: Event | null = null;
    if (post.eventId !== null) {
      const found = events.find((item) => item.id === post.eventId);
      if (found === undefined) return [];
      event = found;
    }
    const photos = post.photoUrls && post.photoUrls.length > 0 ? post.photoUrls : post.photoUrl ? [post.photoUrl] : [];
    return [
      {
        kind: "friend" as const,
        id: post.id,
        author: post.author,
        placeTitle: places.find((item) => item.id === (post.placeId ?? event?.placeId))?.title ?? post.locationLabel ?? null,
        locationLabel: post.locationLabel ?? null,
        distanceKm: null,
        event,
        photoUrls: photos,
        live: event === null ? false : isEventLive(event, now),
        hit: false,
        counts: NO_FEED_COUNTS,
        myStatus: null,
        text: post.text,
        likesCount: post.likesCount,
        likedByMe: post.likedByMe,
        comments: post.comments,
        commentsCount: post.comments.length,
        publishedAt: null,
        photoUrl: photos[0] ?? null,
      },
    ];
  });
}

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

    voteStory(id: string, optionIndex: number): Promise<Story> {
      return this.request(`/stories/${id}/poll`, StorySchema, { method: "POST", body: { optionIndex } });
    }

    /** Store a data URL and return the public path. A url that is already hosted is returned as it is. */
    async storeImage(dataUrl: string, purpose: "story" | "cover" | "feed" | "review"): Promise<string> {
      if (!dataUrl.startsWith("data:image/")) return dataUrl;
      const ticketSchema: ZodSchema<{ id: string; publicUrl: string }> = {
        safeParse(data: unknown) {
          if (typeof data !== "object" || data === null) return { success: false as const, error: "invalid upload" };
          const raw = data as { id?: unknown; publicUrl?: unknown };
          if (typeof raw.id !== "string" || typeof raw.publicUrl !== "string") return { success: false as const, error: "invalid upload" };
          return { success: true as const, data: { id: raw.id, publicUrl: raw.publicUrl } };
        },
      };
      const storedSchema: ZodSchema<{ publicUrl: string }> = {
        safeParse(data: unknown) {
          if (typeof data !== "object" || data === null || typeof (data as { publicUrl?: unknown }).publicUrl !== "string") return { success: false as const, error: "invalid upload" };
          return { success: true as const, data: { publicUrl: (data as { publicUrl: string }).publicUrl } };
        },
      };
      const ticket = await this.request("/uploads", ticketSchema, { body: { purpose } });
      const put = await this.request(`/uploads/${ticket.id}`, storedSchema, { method: "PUT", body: { dataUrl } });
      return put.publicUrl;
    }

    /**
     * Home feed cards (макет, экран 03). A separate endpoint from /feed on purpose: a card carries
     * the event hero, the social counters and the venue offer the wall posts never needed, and the
     * backend gaps behind them (#496 distance/rating/counters/hit, #492 slots) land here, not in
     * the impression post DTO. The userId param is a mock-only convenience, as elsewhere.
     *
     * A server that does not answer this path yet gets the cards built out of what it does answer
     * (feedCardsFromPosts): the лента is the home screen and must open on the real backend, so it
     * shows the posts that exist with the card fields no endpoint fills left empty.
     */
    async listFeedCards(userId: string): Promise<FeedCard[]> {
      try {
        return await this.request(`/feed/cards?userId=${encodeURIComponent(userId)}`, FeedCardsSchema);
      } catch (error) {
        if (!isEndpointMissing(error)) throw error;
        const [posts, events, places] = await Promise.all([this.request("/feed", FeedPostSchema.array()), this.request("/events", EventSchema.array()), this.request("/places", PlaceSchema.array())]);
        return feedCardsFromPosts(posts, events, places, new Date());
      }
    }

    listFeedPosts(eventId?: string, placeId?: string): Promise<FeedPost[]> {
      const query = eventId !== undefined ? `?eventId=${encodeURIComponent(eventId)}` : placeId !== undefined ? `?placeId=${encodeURIComponent(placeId)}` : "";
      return this.request(`/feed${query}`, FeedPostSchema.array());
    }

    getFeedPost(postId: string): Promise<FeedPost> {
      return this.request(`/feed/${postId}`, FeedPostSchema);
    }

    deleteFeedPost(postId: string): Promise<void> {
      return this.requestVoid(`/feed/${postId}`, { method: "DELETE" });
    }

    createFeedPost(payload: CreateFeedPost): Promise<FeedPost> {
      return this.request("/feed", FeedPostSchema, { body: payload });
    }

    /**
     * Autosaves the post draft behind the «Черновик сохранён» line (макет, экран 06). Drafts are not
     * a domain — nothing on the backend answers this path yet, the mock does — so this is the shape
     * and the path that endpoint will take (#502), same arrangement as ./notifications.ts (#494).
     */
    savePostDraft(draft: PostDraft): Promise<PostDraftSaved> {
      return this.request("/feed/drafts", PostDraftSavedSchema, { body: draft });
    }

    /** Toggle a feed like; the userId param is ignored server-side, identity comes from initData. */
    toggleFeedLike(postId: string, userId: string): Promise<FeedPost> {
      return this.request(`/feed/${postId}/like?userId=${encodeURIComponent(userId)}`, FeedPostSchema, { method: "POST" });
    }

    addFeedComment(postId: string, payload: { userId: string; text: string; parentId?: string | null }): Promise<FeedPost> {
      return this.request(`/feed/${postId}/comments`, FeedPostSchema, { body: payload });
    }

    /** Repost one post. The server refuses an own post and a second repost of the same post. */
    repostFeedPost(postId: string, userId = ""): Promise<FeedPost> {
      return this.request(`/feed/${postId}/repost?userId=${encodeURIComponent(userId)}`, FeedPostSchema, { method: "POST" });
    }

    /** Share an event into the feed once. */
    repostFeedEvent(eventId: string, userId = ""): Promise<FeedPost> {
      return this.request(`/feed/events/${eventId}/repost?userId=${encodeURIComponent(userId)}`, FeedPostSchema, { method: "POST" });
    }

    /** Toggle «Я иду» on this post. The screen re-reads the cards for the friends-only count. */
    toggleFeedGoing(postId: string, userId = ""): Promise<FeedPost> {
      return this.request(`/feed/${postId}/going?userId=${encodeURIComponent(userId)}`, FeedPostSchema, { method: "POST" });
    }
  };
}
