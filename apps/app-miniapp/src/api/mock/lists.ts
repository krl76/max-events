// START_MODULE_CONTRACT
// PURPOSE: Mock store for the lists and the follows of the viewer.
// SCOPE: Preset and own lists with their items and shared-collection participants, plus the subscriptions; the HTTP surface is in ./lists.routes.ts.
// DEPENDS: @max-events/api-contracts, ../client.js and the sibling ./mock domain modules it imports
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - resetMockSubscriptions - clear in-memory follows (test isolation)
// - listMockSubscriptions - mock GET /subscriptions for the demo user; the seeded follows of экран 38 (one organizer, three places, three interests) appear on first access
// - createMockSubscription - mock POST /subscriptions: idempotent per target, "unknown" for an unknown place or organizer (backend 404 parity)
// - removeMockSubscription - mock DELETE /subscriptions/:id, "unknown" when it is already gone
// - LIST_PRESET_TITLES - ru titles of the six preset lists (mock seeds them as List.title)
// - mockListItems - shared with discover
// - resetMockLists - clear in-memory lists (test isolation)
// - SHARED_COLLECTION_TITLE - ru title of the seeded shared collection
// - listsFor - The six preset lists of a user, the shared collection for its participants and the demo user's own lists, created with their seed items on first request
// - listSummaries - preset lists of a user with item counters, the saved-item id for the checked event and shared-collection participants
// - listItemCards - items of one list enriched with their events and the participant who added them, newest first (mock)
// - listScreen - One-list aggregate for the list screen: the list, its participants (shared collections) and its item cards; null for an unknown list
// - createMockList - mock POST /lists: a list of one's own (409 past the ceiling)
// - renameMockList - mock PATCH /lists/:id (403 for a preset)
// - removeMockList - mock DELETE /lists/:id with its items (403 for a preset)
// - addMockListItem - Adds an event to a list, idempotent, attributed to the adding user; "no_list"/"no_event" map to 404 in the interceptor
// - removeMockListItem - Removes an item from a list; null when the list or the item is unknown
// END_MODULE_MAP

import { ListPresetSchema } from "@max-events/api-contracts";
import type { CreateSubscription, Friend, List, ListItem, ListPreset, Subscription } from "@max-events/api-contracts";
import { type AddListItem, type ListItemCard, type ListSummary } from "../client";
import { mockFeedPosts, mockUserAsFriend } from "./feed";
import { PLACE_STAMP, mockDemoUser, mockEvents, mockFriendIds, mockFriends, mockOrganization, mockOrganizers, mockPlaces } from "./fixtures";

const mockSubscriptions: Subscription[] = [];

let mockSubscriptionSeq = 0;

let mockSubscriptionsSeeded = false;

export function resetMockSubscriptions(): void {
  mockSubscriptions.length = 0;
  mockSubscriptionSeq = 0;
  mockSubscriptionsSeeded = false;
}

/** Backend parity: the follow carries the name of its target, since the screens cannot resolve a uuid. */
function mockSubscriptionTitle(payload: CreateSubscription): string | null {
  if (payload.type === "interest") return payload.interest;
  if (payload.type === "place") return mockPlaces.find((place) => place.id === payload.placeId)?.title ?? null;
  // A follow of a person carries their name; only people the friend graph knows can be followed here.
  if (payload.type === "user") return mockFriends.find((friend) => friend.id === payload.userId)?.name ?? null;
  return mockOrganizers.some((organizer) => organizer.id === payload.organizerUserId) ? mockOrganization.name : null;
}

function sameMockTarget(row: Subscription, payload: CreateSubscription): boolean {
  if (row.type !== payload.type) return false;
  if (payload.type === "organizer") return row.organizerUserId === payload.organizerUserId;
  if (payload.type === "place") return row.placeId === payload.placeId;
  if (payload.type === "user") return row.targetUserId === payload.userId;
  return (row.interest ?? "").toLowerCase() === payload.interest.toLowerCase();
}

/**
 * What the demo user already follows (макет, экран 38): one organizer, three places and three
 * interests. Seeded rather than left empty because the screen groups and counts them — an empty
 * list demonstrates nothing, and every target here is a fixture the rest of the mock already has.
 */
const MOCK_SUBSCRIPTION_SEED: CreateSubscription[] = [
  { type: "organizer", organizerUserId: mockOrganizers[0].id },
  { type: "place", placeId: mockPlaces[0].id },
  { type: "place", placeId: mockPlaces[2].id },
  { type: "place", placeId: mockPlaces[3].id },
  { type: "interest", interest: "Джаз" },
  { type: "interest", interest: "Падел" },
  { type: "interest", interest: "Волонтёрство" },
];

function seedMockSubscriptions(): void {
  if (mockSubscriptionsSeeded) return;
  // Set before the loop: pushMockSubscription is what the seed itself calls.
  mockSubscriptionsSeeded = true;
  for (const payload of MOCK_SUBSCRIPTION_SEED) pushMockSubscription(payload);
}

export function listMockSubscriptions(): Subscription[] {
  seedMockSubscriptions();
  return [...mockSubscriptions];
}

/** Mock POST /subscriptions: idempotent per target like the backend, "unknown" for a target that does not exist. */
export function createMockSubscription(payload: CreateSubscription): Subscription | "unknown" {
  seedMockSubscriptions();
  return pushMockSubscription(payload);
}

function pushMockSubscription(payload: CreateSubscription): Subscription | "unknown" {
  const title = mockSubscriptionTitle(payload);
  if (title === null) return "unknown";
  const existing = mockSubscriptions.find((row) => sameMockTarget(row, payload));
  if (existing) return existing;
  mockSubscriptionSeq += 1;
  const subscription: Subscription = {
    id: `d0000008-0000-4000-8000-${String(mockSubscriptionSeq).padStart(12, "0")}`,
    userId: mockDemoUser.id,
    type: payload.type,
    organizerUserId: payload.type === "organizer" ? payload.organizerUserId : null,
    placeId: payload.type === "place" ? payload.placeId : null,
    interest: payload.type === "interest" ? payload.interest : null,
    targetUserId: payload.type === "user" ? payload.userId : null,
    title,
    createdAt: new Date().toISOString(),
  };
  mockSubscriptions.push(subscription);
  return subscription;
}

/** Mock DELETE /subscriptions/:id: returns the removed follow, "unknown" when there is nothing to remove. */
export function removeMockSubscription(id: string): Subscription | "unknown" {
  seedMockSubscriptions();
  const index = mockSubscriptions.findIndex((row) => row.id === id);
  if (index < 0) return "unknown";
  return mockSubscriptions.splice(index, 1)[0]!;
}

/** Preset list titles per ListPreset; the lists UI renders List.title as-is. */
export const LIST_PRESET_TITLES: Record<ListPreset, string> = {
  want_to_go: "Хочу сходить",
  favorites: "Избранное",
  weekend: "На выходные",
  with_children: "С детьми",
  with_friends: "С друзьями",
  try_later: "Попробовать потом",
};

/** Preset list items seeded on list creation: [preset, mockEvents index]. */
const MOCK_LIST_SEED: [ListPreset, number][] = [
  ["want_to_go", 0],
  ["favorites", 1],
];

const mockLists = new Map<string, List[]>();

export const mockListItems: ListItem[] = [];

const mockListItemAuthors = new Map<string, Friend>();

let mockListSeq = 0;

let mockListItemSeq = 0;

export function resetMockLists(): void {
  mockLists.clear();
  mockListItems.length = 0;
  mockListItemAuthors.clear();
  mockListSeq = 0;
  mockListItemSeq = 0;
}

/** The seeded shared collection of the demo user and the first friend; both add items, «Отправить в чат» shares it. */
const SHARED_LIST_ID = "70000000-0000-4000-8000-0000000000c0";

export const SHARED_COLLECTION_TITLE = "Куда с родителями";

/** Lists of one's own seeded for the demo user (макет, экран 37): [title, mockEvents indexes]. */
const MOCK_OWN_LIST_SEED: [string, number[]][] = [
  ["Джаз по четвергам", [3, 4]],
  ["Летний список", [5]],
];

const SHARED_LIST_PARTICIPANTS = (): Friend[] => [{ id: mockDemoUser.id, name: "Демо", avatarUrl: null }, mockFriends[0]];

/** Seeded shared-collection items: [mockEvents index, author friend index] (the demo user is index -1). */
const MOCK_SHARED_LIST_SEED: [number, number][] = [
  [6, -1],
  [7, 0],
];

function listItem(listId: string, eventId: string | null, addedBy: Friend | null = null, extra: { placeId?: string | null; feedPostId?: string | null } = {}): ListItem {
  mockListItemSeq += 1;
  const item: ListItem = { id: `71000000-0000-4000-8000-${String(mockListItemSeq).padStart(12, "0")}`, listId, eventId, placeId: extra.placeId ?? null, feedPostId: extra.feedPostId ?? null, addedAt: PLACE_STAMP };
  if (addedBy !== null) mockListItemAuthors.set(item.id, addedBy);
  return item;
}

/** The six preset lists of a user plus the shared collection for its participants, created with their seed items on first request. */
export function listsFor(userId: string): List[] {
  let lists = mockLists.get(userId);
  if (lists) return lists;
  lists = ListPresetSchema.options.map((preset) => {
    mockListSeq += 1;
    return { id: `70000000-0000-4000-8000-${String(mockListSeq).padStart(12, "0")}`, userId, preset, title: LIST_PRESET_TITLES[preset], visibility: "private", createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP };
  });
  for (const [preset, eventIndex] of MOCK_LIST_SEED) {
    const list = lists.find((candidate) => candidate.preset === preset);
    if (list) mockListItems.push(listItem(list.id, mockEvents[eventIndex].id));
  }
  if (userId === mockDemoUser.id || userId === mockFriendIds[0]) {
    lists.push({ id: SHARED_LIST_ID, userId, preset: null, title: SHARED_COLLECTION_TITLE, visibility: "private", createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP });
    if (!mockListItems.some((item) => item.listId === SHARED_LIST_ID)) {
      for (const [eventIndex, authorIndex] of MOCK_SHARED_LIST_SEED) {
        mockListItems.push(listItem(SHARED_LIST_ID, mockEvents[eventIndex].id, authorIndex === -1 ? SHARED_LIST_PARTICIPANTS()[0] : mockFriends[authorIndex]));
      }
    }
  }
  // The demo user is the one «Списки» is shown for, so only they get lists of their own; the shared
  // collection stays first among them, which is where the one-collection fixtures look for it.
  if (userId === mockDemoUser.id) {
    for (const [title, eventIndexes] of MOCK_OWN_LIST_SEED) {
      mockListSeq += 1;
      const own: List = { id: `70000000-0000-4000-8000-${String(mockListSeq).padStart(12, "0")}`, userId, preset: null, title, visibility: "private", createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP };
      lists.push(own);
      for (const eventIndex of eventIndexes) mockListItems.push(listItem(own.id, mockEvents[eventIndex].id));
    }
  }
  mockLists.set(userId, lists);
  return lists;
}

function findList(listId: string): List | undefined {
  for (const lists of mockLists.values()) {
    const found = lists.find((list) => list.id === listId);
    if (found) return found;
  }
  return undefined;
}

/** Preset lists of a user with item counters, shared-collection participants; savedItemId points at the item saving eventId or feedPostId (null when not saved). */
export function listSummaries(userId: string, eventId: string | null, feedPostId: string | null = null): ListSummary[] {
  const rows = listsFor(userId).filter((list) => userId === mockDemoUser.id || list.visibility === "public");
  return rows.map((list) => {
    const items = mockListItems.filter((item) => item.listId === list.id);
    const saved = eventId ? items.find((item) => item.eventId === eventId) : feedPostId ? items.find((item) => item.feedPostId === feedPostId) : undefined;
    return { list, itemsCount: items.length, savedItemId: saved?.id ?? null, participants: list.id === SHARED_LIST_ID ? SHARED_LIST_PARTICIPANTS() : [] };
  });
}

/** Items of one list enriched with their events and the participant who added them (null outside shared collections), newest first; null for an unknown list. */
export function listItemCards(listId: string): ListItemCard[] | null {
  if (!findList(listId)) return null;
  return mockListItems
    .filter((item) => item.listId === listId)
    .flatMap((item): ListItemCard[] => {
      const addedBy = mockListItemAuthors.get(item.id) ?? null;
      if (item.feedPostId !== null) {
        const post = mockFeedPosts.find((candidate) => candidate.id === item.feedPostId);
        if (!post) return [];
        const eventTitle = mockEvents.find((candidate) => candidate.id === post.eventId)?.title ?? "";
        return [{ item, event: null, place: null, post: { id: post.id, text: post.text, photoUrl: post.photoUrl ?? null, author: post.author, eventTitle }, addedBy }];
      }
      if (item.placeId !== null) {
        const place = mockPlaces.find((candidate) => candidate.id === item.placeId);
        return place ? [{ item, event: null, place, post: null, addedBy }] : [];
      }
      const event = mockEvents.find((candidate) => candidate.id === item.eventId);
      return event ? [{ item, event, place: null, post: null, addedBy }] : [];
    })
    .reverse();
}

/** One-list aggregate for the list screen: the list, its participants (shared collections) and its item cards; null for an unknown list. */
export function listScreen(listId: string): { list: List; participants: Friend[]; items: ListItemCard[] } | null {
  const list = findList(listId);
  if (!list) return null;
  return { list, participants: list.id === SHARED_LIST_ID ? SHARED_LIST_PARTICIPANTS() : [], items: listItemCards(listId) ?? [] };
}

/** Backend MAX_CUSTOM_LISTS parity. */
const MOCK_MAX_CUSTOM_LISTS = 20;

/** Backend parity: a list of one's own, appended after the six presets; "too_many" maps to 409. */
export function createMockList(userId: string, title: string): List | "too_many" {
  const lists = listsFor(userId);
  // The seeded shared collection is nobody's "own list", so it does not eat into the ceiling.

  if (lists.filter((row) => row.preset === null && row.id !== SHARED_LIST_ID).length >= MOCK_MAX_CUSTOM_LISTS) return "too_many";
  mockListSeq += 1;
  const now = new Date().toISOString();
  const list: List = { id: `70000000-0000-4000-8000-${String(mockListSeq).padStart(12, "0")}`, userId, preset: null, title, visibility: "private", createdAt: now, updatedAt: now };
  lists.push(list);
  return list;
}

/**
 * A preset refuses both rename and delete: the backend recreates it, so the change would not stick.
 *
 * The shared collection is not refused. It is a mock-side fiction — the server has no shared-list
 * concept at all, so PATCH/DELETE there check the preset flag and nothing else. Banning it here made
 * the mock stricter than the thing it stands in for and hid the rename/delete of экран 39.
 */
export function renameMockList(listId: string, title: string): List | "no_list" | "preset" {
  const list = findList(listId);
  if (!list) return "no_list";
  if (list.preset !== null) return "preset";
  list.title = title;
  list.updatedAt = new Date().toISOString();
  return list;
}

export function setMockListVisibility(listId: string, visibility: "public" | "private"): List | "no_list" | "preset" {
  const list = findList(listId);
  if (!list) return "no_list";
  if (list.preset !== null) return "preset";
  list.visibility = visibility;
  list.updatedAt = new Date().toISOString();
  return list;
}

export function removeMockList(listId: string): List | "no_list" | "preset" {
  const list = findList(listId);
  if (!list) return "no_list";
  if (list.preset !== null) return "preset";
  for (const [userId, lists] of mockLists) {
    const index = lists.findIndex((row) => row.id === listId);
    if (index !== -1) mockLists.set(userId, [...lists.slice(0, index), ...lists.slice(index + 1)]);
  }
  // The database drops the items through ON DELETE CASCADE; here they are swept by hand.
  for (let index = mockListItems.length - 1; index >= 0; index -= 1) {
    if (mockListItems[index]!.listId === listId) {
      mockListItemAuthors.delete(mockListItems[index]!.id);
      mockListItems.splice(index, 1);
    }
  }
  return list;
}

/** Adds an event, place or post to a list, idempotent; "no_list"/"no_event"/"no_post" map to 404. */
export function addMockListItem(listId: string, payload: AddListItem): ListItem | "no_list" | "no_event" | "no_post" {
  if (!findList(listId)) return "no_list";
  if (payload.feedPostId !== undefined) {
    if (!mockFeedPosts.some((post) => post.id === payload.feedPostId)) return "no_post";
    const existing = mockListItems.find((item) => item.listId === listId && item.feedPostId === payload.feedPostId);
    if (existing) return existing;
    const item = listItem(listId, null, mockUserAsFriend(payload.userId), { feedPostId: payload.feedPostId });
    mockListItems.push(item);
    return item;
  }
  if (payload.eventId === undefined || !mockEvents.some((event) => event.id === payload.eventId)) return "no_event";
  const existing = mockListItems.find((item) => item.listId === listId && item.eventId === payload.eventId);
  if (existing) return existing;
  const item = listItem(listId, payload.eventId, mockUserAsFriend(payload.userId));
  mockListItems.push(item);
  return item;
}

/** Removes an item from a list; null when the list or the item is unknown. */
export function removeMockListItem(listId: string, itemId: string): ListItem | null {
  const index = mockListItems.findIndex((item) => item.listId === listId && item.id === itemId);
  if (index === -1) return null;
  return mockListItems.splice(index, 1)[0];
}
