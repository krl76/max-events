// START_MODULE_CONTRACT
// PURPOSE: Mock feed store: the stories rail and the impression wall with its likes and comments.
// SCOPE: Story fixtures (brandbook gradients, no glyph) plus the in-memory posts; the HTTP surface is in ./feed.routes.ts.
// DEPENDS: @max-events/api-contracts, ../client.js and the sibling ./mock domain modules it imports
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - mockFriendStories - seeded friend story fixtures (gradient placeholder images)
// - listMockStories - own story (localStorage) + friend fixtures
// - createMockStory - publish the own mock story from a data-URL photo (localStorage)
// - mockFeedPosts - shared with moderation
// - seedMockFeed - shared with moderation
// - resetMockFeed - restore seeded impression posts (test isolation)
// - mockUserAsFriend - shared with lists
// - feedPosts - impression posts newest first, optionally only one event (the event wall)
// - toggleMockFeedLike - Likes/unlikes a post as the user; the returned post carries the new counter and state; null for an unknown post
// - addMockFeedComment - Appends a comment attributed to its author; null for an unknown post (mock 404)
// - createMockFeedPost - Publishes an impression post as its author; null for an unknown event (mock 404)
// END_MODULE_MAP

import { StorySchema } from "@max-events/api-contracts";
import type { Story } from "@max-events/api-contracts";
import { type CreateFeedPost, type FeedComment, type FeedPost } from "../client";
import { mockDemoUser, mockEvents, mockFriendIds, mockFriends } from "./fixtures";

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

export function createMockStory(imageUrl: string): Story {
  const story: Story = { id: "e1000000-0000-4000-8000-00000000000a", userId: mockDemoUser.id, imageUrl, createdAt: new Date().toISOString() };
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

const mockFeedLikes = new Set<string>();

let mockFeedSeq = 0;

let mockFeedCommentSeq = 0;

export function seedMockFeed(): void {
  mockFeedPosts.length = 0;
  mockFeedLikes.clear();
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

/** Publishes an impression post as its author; null for an unknown event (mock 404). */
export function createMockFeedPost(payload: CreateFeedPost): FeedPost | null {
  if (!mockEvents.some((event) => event.id === payload.eventId)) return null;
  mockFeedSeq += 1;
  const post: FeedPost = { id: `30000000-0000-4000-8000-${String(mockFeedSeq).padStart(12, "0")}`, author: mockUserAsFriend(payload.userId), eventId: payload.eventId, text: payload.text, photoUrl: payload.photoUrl ?? null, likesCount: 0, likedByMe: false, comments: [] };
  mockFeedPosts.push(post);
  return post;
}
