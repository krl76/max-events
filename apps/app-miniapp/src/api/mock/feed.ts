// START_MODULE_CONTRACT
// PURPOSE: Mock feed store: the stories rail, the home feed cards (макет, экран 03), the impression wall with its likes and comments, and the publication payloads of макет, экраны 05 и 06 that no backend column holds yet (#502).
// SCOPE: Story fixtures (brandbook gradients, no glyph), the seeded feed cards, the in-memory posts and the composed story/post extras; the HTTP surface is in ./feed.routes.ts.
// DEPENDS: @max-events/api-contracts, ../client.js and the sibling ./mock domain modules it imports
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - mockFeedCards - seeded home feed cards (макет, экран 03): three friend posts around one venue post, own statuses read from the participation stores
// - mockFriendStories - seeded friend story fixtures (gradient placeholder images)
// - listMockStories - own story (localStorage) + friend fixtures
// - createMockStory - publish the own mock story from a data-URL photo (localStorage), keeping the composition the backend still strips (#502)
// - mockStoryCompositions - compositions published through the mock, newest last; the store #502 will replace
// - mockFeedPosts - shared with moderation
// - seedMockFeed - shared with moderation
// - resetMockFeed - restore seeded impression posts (test isolation)
// - mockUserAsFriend - shared with lists
// - feedPosts - impression posts newest first, optionally only one event (the event wall)
// - toggleMockFeedLike - Likes/unlikes a post as the user; the returned post carries the new counter and state; null for an unknown post
// - addMockFeedComment - Appends a comment attributed to its author; null for an unknown post (mock 404)
// - createMockFeedPost - Publishes an impression post as its author; null for an unknown event (mock 404)
// - mockFeedPostExtras - by post id: the place/friends/audience/join/photo-grid fields of макет, экран 06 the post entity cannot hold (#502)
// - mockPostDrafts - by author: the last autosaved post draft (макет, экран 06); no draft table exists (#502)
// - saveMockPostDraft - stores one author's draft and answers when it was saved
// END_MODULE_MAP

import { StorySchema } from "@max-events/api-contracts";
import type { Event, ParticipationStatus, Story } from "@max-events/api-contracts";
import { type CreateFeedPost, type FeedCard, type FeedCardCounts, type FeedComment, type FeedFriendCard, type FeedPlaceCard, type FeedPost, type PostDraft, type PostDraftSaved, type StoryComposition } from "../client";
import { mockParticipations, mockPlaceStatuses } from "./catalog";
import { mockDemoUser, mockEvents, mockFriendIds, mockFriends, mockPlaces } from "./fixtures";

/** Gradient placeholder image (data URL) for seeded story fixtures; both stops are brandbook colours and the frame carries no glyph. */
function storyImage(colorFrom: string, colorTo: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colorFrom}"/><stop offset="1" stop-color="${colorTo}"/></linearGradient></defs><rect width="720" height="1280" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** The six brandbook colours, as the story gradients are allowed to pair them. */
const STORY_GRADIENTS: ReadonlyArray<readonly [string, string]> = [
  ["#471aff", "#6e1aff"],
  ["#6e1aff", "#9500ff"],
  ["#9500ff", "#471aff"],
  ["#00bfff", "#471aff"],
  ["#0d001a", "#6e1aff"],
];

const storyGradient = (index: number): readonly [string, string] => STORY_GRADIENTS[index % STORY_GRADIENTS.length];

const MOCK_OWN_STORY_KEY = "max-events.mock-own-story";

/** Seeded friend stories: every friend has 1–3 stories so the rail is fully active. */
export const mockFriendStories: Story[] = [
  { id: "e1000000-0000-4000-8000-000000000001", userId: mockFriendIds[0], imageUrl: storyImage(...storyGradient(0)), createdAt: "2026-09-16T09:00:00+03:00" },
  { id: "e1000000-0000-4000-8000-000000000002", userId: mockFriendIds[0], imageUrl: storyImage(...storyGradient(1)), createdAt: "2026-09-16T10:00:00+03:00" },
  { id: "e1000000-0000-4000-8000-000000000003", userId: mockFriendIds[1], imageUrl: storyImage(...storyGradient(2)), createdAt: "2026-09-16T11:00:00+03:00" },
  { id: "e1000000-0000-4000-8000-000000000004", userId: mockFriendIds[2], imageUrl: storyImage(...storyGradient(3)), createdAt: "2026-09-16T11:30:00+03:00" },
  { id: "e1000000-0000-4000-8000-000000000005", userId: mockFriendIds[2], imageUrl: storyImage(...storyGradient(4)), createdAt: "2026-09-16T12:00:00+03:00" },
  { id: "e1000000-0000-4000-8000-000000000006", userId: mockFriendIds[3], imageUrl: storyImage(...storyGradient(5)), createdAt: "2026-09-16T12:30:00+03:00" },
  { id: "e1000000-0000-4000-8000-000000000007", userId: mockFriendIds[4], imageUrl: storyImage(...storyGradient(6)), createdAt: "2026-09-16T13:00:00+03:00" },
  { id: "e1000000-0000-4000-8000-000000000008", userId: mockFriendIds[4], imageUrl: storyImage(...storyGradient(7)), createdAt: "2026-09-16T13:30:00+03:00" },
  { id: "e1000000-0000-4000-8000-000000000009", userId: mockFriendIds[4], imageUrl: storyImage(...storyGradient(8)), createdAt: "2026-09-16T14:00:00+03:00" },
  { id: "e1000000-0000-4000-8000-00000000000b", userId: mockFriendIds[5], imageUrl: storyImage(...storyGradient(9)), createdAt: "2026-09-16T14:30:00+03:00" },
  { id: "e1000000-0000-4000-8000-00000000000c", userId: mockFriendIds[6], imageUrl: storyImage(...storyGradient(10)), createdAt: "2026-09-16T15:00:00+03:00" },
];

/** Own mock story persists in localStorage so it survives reloads. */
function readOwnStory(): Story | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(MOCK_OWN_STORY_KEY);
  if (raw === null) return null;
  try {
    const parsed = StorySchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function listMockStories(): Story[] {
  const own = readOwnStory();
  return own ? [own, ...mockFriendStories] : [...mockFriendStories];
}

/**
 * What POST /stories keeps beyond the image (макет, экран 05). The story entity has columns for the
 * image and nothing else, and the controller strips the rest, so the composed sticker/poll/audience
 * live here until #502 gives them a home — same arrangement the screen tests read.
 */
export const mockStoryCompositions: StoryComposition[] = [];

export function createMockStory(imageUrl: string, composition: StoryComposition | null = null): Story {
  const story: Story = { id: "e1000000-0000-4000-8000-00000000000a", userId: mockDemoUser.id, imageUrl, createdAt: new Date().toISOString() };
  if (composition !== null) mockStoryCompositions.push(composition);
  if (typeof window !== "undefined") window.localStorage.setItem(MOCK_OWN_STORY_KEY, JSON.stringify(story));
  return story;
}

type FeedSeed = { author: number; event: number; text: string; likes: number; comments?: { author: number; text: string }[] };

/** Seeded impression posts (Instagram-style feed); the photo is a CSS placeholder, authors are friends. */
const MOCK_FEED_SEED: FeedSeed[] = [
  { author: 0, event: 1, text: "Выставка впечатляет — очередь к картине на входе.", likes: 3, comments: [{ author: 1, text: "Тоже иду на выходных!" }] },
  { author: 1, event: 5, text: "Матч был огонь, трибуны горели до финального свистка.", likes: 1 },
  { author: 2, event: 11, text: "Гастрофестиваль: обязательно попробуйте сырные ряды.", likes: 2, comments: [{ author: 0, text: "Скинь фото сырной лавки" }] },
];

export const mockFeedPosts: FeedPost[] = [];

/** The publication fields of макет, экран 06 the FeedPost entity has nowhere to put, kept by post id (#502). */
export const mockFeedPostExtras = new Map<string, Pick<CreateFeedPost, "photoUrls" | "placeId" | "taggedFriendIds" | "audience" | "allowJoin">>();

/** One autosaved draft per author (макет, экран 06, «Черновик сохранён»); drafts are not a domain (#502). */
export const mockPostDrafts = new Map<string, PostDraft>();

const mockFeedLikes = new Set<string>();

let mockFeedSeq = 0;

let mockFeedCommentSeq = 0;

export function seedMockFeed(): void {
  mockFeedPosts.length = 0;
  mockFeedLikes.clear();
  mockFeedPostExtras.clear();
  mockPostDrafts.clear();
  mockStoryCompositions.length = 0;
  mockFeedCommentSeq = 0;
  MOCK_FEED_SEED.forEach((seed, index) => {
    mockFeedSeq = index + 1;
    mockFeedPosts.push({
      id: `30000000-0000-4000-8000-${String(mockFeedSeq).padStart(12, "0")}`,
      author: mockFriends[seed.author],
      eventId: mockEvents[seed.event].id,
      text: seed.text,
      photoUrl: null,
      likesCount: seed.likes,
      likedByMe: false,
      comments: (seed.comments ?? []).map((comment) => {
        mockFeedCommentSeq += 1;
        return { id: `31000000-0000-4000-8000-${String(mockFeedCommentSeq).padStart(12, "0")}`, author: mockFriends[comment.author], text: comment.text };
      }),
    });
  });
}
seedMockFeed();

export function resetMockFeed(): void {
  seedMockFeed();
}

export function mockUserAsFriend(userId: string): FeedPost["author"] {
  return mockFriends.find((friend) => friend.id === userId) ?? { id: userId, name: "Демо", avatarUrl: null };
}

/** Impression posts newest first; with an eventId — only the posts of that event (the event wall). */
export function feedPosts(eventId: string | null, placeId: string | null = null): FeedPost[] {
  const newestFirst = [...mockFeedPosts].reverse();
  if (eventId !== null) return newestFirst.filter((post) => post.eventId === eventId);
  if (placeId === null) return newestFirst;
  // The wall of a place is the posts of the events held there, same as the server computes it.
  const atPlace = new Set(mockEvents.filter((event) => event.placeId === placeId).map((event) => event.id));
  return newestFirst.filter((post) => atPlace.has(post.eventId));
}

/** Likes/unlikes a post as the user; the returned post carries the new counter and state; null for an unknown post. */
export function toggleMockFeedLike(postId: string, userId: string): FeedPost | null {
  const post = mockFeedPosts.find((item) => item.id === postId);
  if (!post) return null;
  const key = `${userId}:${postId}`;
  if (mockFeedLikes.has(key)) {
    mockFeedLikes.delete(key);
    post.likesCount -= 1;
    post.likedByMe = false;
  } else {
    mockFeedLikes.add(key);
    post.likesCount += 1;
    post.likedByMe = true;
  }
  return post;
}

/** Appends a comment attributed to its author; null for an unknown post (mock 404). */
export function addMockFeedComment(postId: string, payload: { userId: string; text: string }): FeedPost | null {
  const post = mockFeedPosts.find((item) => item.id === postId);
  if (!post) return null;
  mockFeedCommentSeq += 1;
  const comment: FeedComment = { id: `31000000-0000-4000-8000-${String(mockFeedCommentSeq).padStart(12, "0")}`, author: mockUserAsFriend(payload.userId), text: payload.text };
  post.comments.push(comment);
  return post;
}

const MINUTE_MS = 60 * 1000;

/** Relative, not absolute: the seeded cards must keep reading «25 минут назад» whenever the demo is opened. */
const publishedAgo = (minutes: number): string => new Date(Date.now() - minutes * MINUTE_MS).toISOString();

/**
 * What the home feed card adds to an impression post. Kept next to the posts rather than inside them:
 * a card id IS its post id, so «нравится» and the comment form keep hitting /feed/:id, and when the
 * real endpoint starts answering distance, counters and the hit flag (#496) only this table goes away.
 */
type FeedCardExtra = {
  /** The backend will derive it from startsAt/endsAt; the fixture pins it so the demo screen shows the «Сейчас идёт» chip. */
  live: boolean;
  /** «ХИТ НЕДЕЛИ» — the events domain has no such flag (#496), so it is seeded here. */
  hit: boolean;
  distanceKm: number;
  counts: FeedCardCounts;
  /** Comments the post carries beyond the ones stored, so the card can say «ещё 2 комментария». */
  extraComments: number;
  agoMinutes: number;
};

/** By post index: a live afisha post, a sold-out sport post with the «ХИТ НЕДЕЛИ» badge, a festival post with free seats. */
const MOCK_FEED_CARD_EXTRAS: FeedCardExtra[] = [
  { live: true, hit: false, distanceKm: 1.2, counts: { wantsToGo: 12, going: 4, waitlist: null, freeSeats: null }, extraComments: 2, agoMinutes: 25 },
  { live: false, hit: true, distanceKm: 4.8, counts: { wantsToGo: null, going: 16, waitlist: 7, freeSeats: null }, extraComments: 5, agoMinutes: 120 },
  { live: false, hit: false, distanceKm: 2.1, counts: { wantsToGo: null, going: 28, waitlist: null, freeSeats: 12 }, extraComments: 1, agoMinutes: 26 * 60 },
];

/** The venue post of the feed (макет, экран 03): everything behind it — rating, travel time, slots and the price — is mocked (#496, #492). */
const MOCK_FEED_PLACE_CARD = {
  place: 0,
  verified: true,
  distanceKm: 2.4,
  travelMinutes: 15,
  rating: 4.9,
  pricePerHourRub: 800,
  slotLabel: "Свободно сегодня с 14:00",
  offerLabel: "Мангальная зона",
  goingFriends: [0, 1],
  title: "Мангальная зона и тёплая беседка №4 у залива",
  text: "Оборудованная закрытая мангальная территория на берегу. Защита от ветра, удобный подъезд, прокат шампуров и решёток на месте.",
  quote: [0, "Чистый мангал, навес от дождя, розетка и закат над рекой"] as [number, string],
  likes: 318,
  commentsCount: 32,
  agoMinutes: 60,
};

/** Own status bumps the counter it belongs to: the backend counts the viewer too, and a card that ignored them would read as stale right after «Пойду». */
function countsWithMine(counts: FeedCardCounts, mine: ParticipationStatus | null): FeedCardCounts {
  const bump = (value: number | null, status: ParticipationStatus) => (value === null || mine !== status ? value : value + 1);
  return { ...counts, wantsToGo: bump(counts.wantsToGo, "wants_to_go"), going: bump(counts.going, "going") };
}

const NO_COUNTS: FeedCardCounts = { wantsToGo: null, going: null, waitlist: null, freeSeats: null };

/** A card is its post plus the extras; a post published after the seed simply has none of them, and says so with nulls. */
function friendCard(post: FeedPost, event: Event, extra: FeedCardExtra | undefined, userId: string): FeedFriendCard {
  const mine = mockParticipations.get(`${userId}:${event.id}`)?.status ?? null;
  return {
    kind: "friend",
    id: post.id,
    author: post.author,
    placeTitle: mockPlaces.find((item) => item.id === event.placeId)?.title ?? null,
    distanceKm: extra?.distanceKm ?? null,
    event,
    live: extra?.live ?? false,
    hit: extra?.hit ?? false,
    counts: countsWithMine(extra?.counts ?? NO_COUNTS, mine),
    myStatus: mine,
    text: post.text,
    likesCount: post.likesCount,
    likedByMe: post.likedByMe,
    comments: post.comments,
    commentsCount: post.comments.length + (extra?.extraComments ?? 0),
    publishedAt: publishedAgo(extra?.agoMinutes ?? 0),
  };
}

function placeCard(userId: string): FeedPlaceCard {
  const seed = MOCK_FEED_PLACE_CARD;
  const place = mockPlaces[seed.place];
  return {
    kind: "place",
    id: "32000000-0000-4000-8000-000000000101",
    place,
    verified: seed.verified,
    distanceKm: seed.distanceKm,
    travelMinutes: seed.travelMinutes,
    rating: seed.rating,
    pricePerHourRub: seed.pricePerHourRub,
    slotLabel: seed.slotLabel,
    offerLabel: seed.offerLabel,
    goingFriends: seed.goingFriends.map((index) => mockFriends[index]),
    title: seed.title,
    text: seed.text,
    quote: { author: mockFriends[seed.quote[0]], text: seed.quote[1] },
    likesCount: seed.likes,
    likedByMe: false,
    commentsCount: seed.commentsCount,
    myStatus: mockPlaceStatuses.get(`${userId}:${place.id}`) ?? null,
    publishedAt: publishedAgo(seed.agoMinutes),
  };
}

/** Home feed cards in the order of the design: freshly published posts on top, then a friend post, the venue post and the rest. */
export function mockFeedCards(userId: string): FeedCard[] {
  const cards = mockFeedPosts.flatMap((post, index) => {
    const event = mockEvents.find((item) => item.id === post.eventId);
    return event === undefined ? [] : [friendCard(post, event, MOCK_FEED_CARD_EXTRAS[index], userId)];
  });
  const seeded = cards.slice(0, MOCK_FEED_CARD_EXTRAS.length);
  const fresh = cards.slice(MOCK_FEED_CARD_EXTRAS.length).reverse();
  return [...fresh, ...seeded.slice(0, 1), placeCard(userId), ...seeded.slice(1)];
}

/** Publishes an impression post as its author; null for an unknown event (mock 404). */
export function createMockFeedPost(payload: CreateFeedPost): FeedPost | null {
  if (!mockEvents.some((event) => event.id === payload.eventId)) return null;
  mockFeedSeq += 1;
  const post: FeedPost = { id: `30000000-0000-4000-8000-${String(mockFeedSeq).padStart(12, "0")}`, author: mockUserAsFriend(payload.userId), eventId: payload.eventId, text: payload.text, photoUrl: payload.photoUrl ?? null, likesCount: 0, likedByMe: false, comments: [] };
  mockFeedPosts.push(post);
  // Kept beside the post rather than inside it: none of these has a column, and when #502 lands only this table goes away.
  mockFeedPostExtras.set(post.id, { photoUrls: payload.photoUrls ?? [], placeId: payload.placeId ?? null, taggedFriendIds: payload.taggedFriendIds ?? [], audience: payload.audience ?? "friends", allowJoin: payload.allowJoin ?? false });
  return post;
}

/** Stores one author's draft and answers when it was saved; a later draft replaces the earlier one. */
export function saveMockPostDraft(draft: PostDraft): PostDraftSaved {
  mockPostDrafts.set(draft.userId, draft);
  return { savedAt: new Date().toISOString() };
}
