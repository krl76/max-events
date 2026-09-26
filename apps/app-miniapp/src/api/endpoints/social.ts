// START_MODULE_CONTRACT
// PURPOSE: Social graph endpoints of the api client: friends, the gathering flow, UGC micro-events, reverse discovery and people matching.
// SCOPE: GET /friends[/activity|/availability|/sync], POST /friends/sync, PUT /friends/follows, GET /users/:id/{following,followers}, the /gatherings surface, the /micro-events surface (the card falling back to the list plus GET /places and GET /friends), GET /discovery[/friend-places|/friends/:userId/route], GET /people.
// DEPENDS: ./transport.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CreateGathering - gathering launch payload (event + friend ids + proposed meeting time)
// - CreateMicroEvent - micro-event creation payload (author, what/when/where, limit)
// - FriendSuggestion - one person of the onboarding friends step: friend + the hint line under the name + whether the viewer follows them
// - FriendsSync - when the MAX contacts of the viewer were last synchronised (макет, экран 26)
// - MicroParticipant - one participant of a micro-event card: the person and whether they are the author who called it
// - MicroEventCard - micro-event card aggregate (макет, экран 25): the event, its venue and the participants by name
// - microEventCardFrom - one card built out of GET /micro-events + GET /places + GET /friends, for a server that answers the list but not a single gathering
// - DiscoveryFriendCard - one friend row of экран 27: unseen places plus the «история посещений скрыта» state
// - DiscoveryScreen - экран 27 payload: the total of unseen places and the friend rows
// - FriendRouteStop - one stop of a friend route: place, when they were there and what they did
// - FriendRouteScreen - экран 28 payload: the friend and their ordered stops
// - withSocial - ApiClient.listFriends / getFriendsActivity / getFriendAvailability / getFriendsSync / syncFriends / listFriendSuggestions / followFriends / listFollowing / listFollowers / createGathering / getGathering / respondToGathering / listMicroEvents / getMicroEventCard / createMicroEvent / joinMicroEvent / leaveMicroEvent / getDiscovery / listFriendPlaces / getFriendRoute / getPeople
// END_MODULE_MAP

import { DiscoveryResponseSchema, FriendActivityByFriendSchema, FriendAvailabilitySchema, FriendPlaceVisitSchema, FriendRouteSchema, FriendSchema, GatheringSchema, MicroBudgetSchema, MicroEventSchema, PeopleResponseSchema, PlaceSchema } from "@max-events/api-contracts";
import type { CreatePlanExpenseWrite, Friend, FriendActivityByFriend, FriendAvailability, FriendPlaceVisit, Gathering, InviteeResponse, MicroBudget, MicroEvent, PeopleResponse, Place } from "@max-events/api-contracts";
import { isEndpointMissing } from "./transport";
import type { ApiMixin, ZodSchema } from "./transport";

/** Gathering launch payload: event, invited friends, proposed meeting time. */
export interface CreateGathering {
  eventId: string;
  friendIds: string[];
  proposedMeetingAt: string;
}

/** Micro-event creation payload: the author plus what/when/where (exactly one of locationText/placeId) and the participant limit. */
export interface CreateMicroEvent {
  userId: string;
  title: string;
  startsAt: string;
  locationText?: string;
  placeId?: string;
  participantsLimit: number;
  inviteeIds?: string[];
}

/**
 * One person of the onboarding friends step (макет, экран 02). Following a person has no backend
 * mechanic — `subscriptions` knows organizer/place/interest only (#501) — and `Friend` carries nothing
 * beyond id/name/avatar, so both the hint line and the follow state are mock today. The shape here is
 * the one the future endpoint answers with, so the screen connects to it without a change.
 */
export interface FriendSuggestion {
  friend: Friend;
  hint: string | null;
  followed: boolean;
}

const FriendSuggestionSchema: ZodSchema<FriendSuggestion> = {
  safeParse(data: unknown) {
    if (typeof data !== "object" || data === null) return { success: false as const, error: "expected a friend suggestion" };
    const raw = data as Record<string, unknown>;
    const friend = FriendSchema.safeParse(raw.friend);
    if (!friend.success) return { success: false as const, error: friend.error };
    if (raw.hint !== null && typeof raw.hint !== "string") return { success: false as const, error: "invalid friend suggestion hint" };
    if (typeof raw.followed !== "boolean") return { success: false as const, error: "invalid friend suggestion follow state" };
    return { success: true as const, data: { friend: friend.data, hint: raw.hint, followed: raw.followed } };
  },
};

function listSchema<T>(item: ZodSchema<T>, label: string): ZodSchema<T[]> {
  return {
    safeParse(data: unknown) {
      if (!Array.isArray(data)) return { success: false as const, error: `expected a list of ${label}` };
      const items: T[] = [];
      for (const entry of data) {
        const parsed = item.safeParse(entry);
        if (!parsed.success) return { success: false as const, error: parsed.error };
        items.push(parsed.data);
      }
      return { success: true as const, data: items };
    },
  };
}

const FriendSuggestionListSchema = listSchema(FriendSuggestionSchema, "friend suggestions");

const FollowedIdsSchema = listSchema<string>(
  {
    safeParse: (data: unknown) => (typeof data === "string" ? { success: true as const, data } : { success: false as const, error: "expected a user id" }),
  },
  "followed user ids",
);

/**
 * When the MAX contact list was last pulled into the friend graph (макет, экран 26 — «Синхронизировано
 * 2 часа назад»). POST /friends/sync exists and answers with the graph it rebuilt, but nothing records
 * *when* it ran, so the stamp comes from the mock behind the GET the future endpoint will answer with;
 * `null` is «ещё ни разу», not «неизвестно».
 */
export interface FriendsSync {
  syncedAt: string | null;
}

const FriendsSyncSchema: ZodSchema<FriendsSync> = {
  safeParse(data: unknown) {
    if (typeof data !== "object" || data === null) return { success: false as const, error: "expected a friends sync stamp" };
    const { syncedAt } = data as { syncedAt?: unknown };
    if (syncedAt !== null && typeof syncedAt !== "string") return { success: false as const, error: "invalid friends sync stamp" };
    return { success: true as const, data: { syncedAt } };
  },
};

/** One participant of a micro-event card; the author is the person who called the gathering («позвал» in the design). */
export interface MicroParticipant {
  friend: Friend;
  author: boolean;
}

/**
 * The micro-event card (макет, экран 25). MicroEvent carries `participantIds` and nothing else about the
 * people, so a screen that must print «Анна Кравцова · позвал» has no names to print. The aggregate is the
 * shape GET /micro-events/:id will answer with — a card is one request, not a list scan plus a name lookup.
 */
export interface MicroEventCard {
  event: MicroEvent;
  place: Place | null;
  participants: MicroParticipant[];
}

const MicroEventCardSchema: ZodSchema<MicroEventCard> = {
  safeParse(data: unknown) {
    if (typeof data !== "object" || data === null) return { success: false as const, error: "expected a micro-event card" };
    const raw = data as Record<string, unknown>;
    const event = MicroEventSchema.safeParse(raw.event);
    if (!event.success) return { success: false as const, error: event.error };
    let place: Place | null = null;
    if (raw.place !== null && raw.place !== undefined) {
      const parsed = PlaceSchema.safeParse(raw.place);
      if (!parsed.success) return { success: false as const, error: parsed.error };
      place = parsed.data;
    }
    const participants: MicroParticipant[] = [];
    if (!Array.isArray(raw.participants)) return { success: false as const, error: "expected micro-event participants" };
    for (const entry of raw.participants) {
      if (typeof entry !== "object" || entry === null) return { success: false as const, error: "expected a micro-event participant" };
      const row = entry as Record<string, unknown>;
      const friend = FriendSchema.safeParse(row.friend);
      if (!friend.success) return { success: false as const, error: friend.error };
      participants.push({ friend: friend.data, author: row.author === true });
    }
    return { success: true as const, data: { event: event.data, place, participants } };
  },
};

/**
 * One friend row of экран 27. `visitHistoryHidden` is the «История посещений скрыта» state the design
 * draws as a normal outcome rather than an error: today the backend simply drops such a friend from the
 * summary, so the flag reads `false` against the live API and the row appears only on the mock.
 */
export interface DiscoveryFriendCard {
  friend: Friend;
  newPlacesCount: number;
  places: Place[];
  visitHistoryHidden: boolean;
}

export interface DiscoveryScreen {
  newPlacesCount: number;
  byFriend: DiscoveryFriendCard[];
}

const DiscoveryScreenSchema: ZodSchema<DiscoveryScreen> = {
  safeParse(data: unknown) {
    const parsed = DiscoveryResponseSchema.safeParse(data);
    if (!parsed.success) return { success: false as const, error: parsed.error };
    // Zod strips what the contract does not name, so the flag has to be read off the raw payload.
    const rows = Array.isArray((data as { byFriend?: unknown }).byFriend) ? (data as { byFriend: unknown[] }).byFriend : [];
    const byFriend = parsed.data.byFriend.map((entry, index) => ({ ...entry, visitHistoryHidden: (rows[index] as { visitHistoryHidden?: unknown } | undefined)?.visitHistoryHidden === true }));
    return { success: true as const, data: { newPlacesCount: parsed.data.newPlacesCount, byFriend } };
  },
};

/**
 * One stop of a friend route (макет, экран 28 — «11:20 · завтрак»). FriendRoute is a bare place list, so
 * both the clock and the note are mock; they stay nullable because the live route answers without them
 * and a timeline without times is still a timeline.
 */
export interface FriendRouteStop {
  place: Place;
  visitedAt: string | null;
  note: string | null;
}

export interface FriendRouteScreen {
  friend: Friend;
  stops: FriendRouteStop[];
}

const FriendRouteScreenSchema: ZodSchema<FriendRouteScreen> = {
  safeParse(data: unknown) {
    const parsed = FriendRouteSchema.safeParse(data);
    if (!parsed.success) return { success: false as const, error: parsed.error };
    const rows = Array.isArray((data as { stops?: unknown }).stops) ? (data as { stops: unknown[] }).stops : [];
    const stops = parsed.data.places.map((place, index) => {
      const row = rows[index] as { visitedAt?: unknown; note?: unknown } | undefined;
      return { place, visitedAt: typeof row?.visitedAt === "string" ? row.visitedAt : null, note: typeof row?.note === "string" ? row.note : null };
    });
    return { success: true as const, data: { friend: parsed.data.friend, stops } };
  },
};

/**
 * One micro-event card picked out of the list, for a server that answers GET /micro-events but not
 * GET /micro-events/:id. The names come from the friend graph, which is the only name directory the
 * client can read: a participant outside it — a stranger who joined, or the viewer themself — is left
 * out of the roster rather than listed without a name, and the «N из M» counter above it stays the
 * event's own and therefore still whole. Null when the list does not carry that id at all, so «такого
 * сбора больше нет» remains an answer about the gathering and not about the endpoint.
 */
export function microEventCardFrom(id: string, events: MicroEvent[], places: Place[], friends: Friend[]): MicroEventCard | null {
  const event = events.find((item) => item.id === id);
  if (event === undefined) return null;
  const byId = new Map<string, Friend>();
  for (const friend of event.participants) byId.set(friend.id, friend);
  for (const friend of friends) if (!byId.has(friend.id)) byId.set(friend.id, friend);
  const participants = event.participantIds.flatMap((userId) => {
    const friend = byId.get(userId);
    return friend === undefined ? [] : [{ friend, author: userId === event.authorId }];
  });
  return { event, place: places.find((item) => item.id === event.placeId) ?? null, participants };
}

const CloseFriendSchema: ZodSchema<{ close: boolean }> = {
  safeParse(data: unknown) {
    if (typeof data !== "object" || data === null || typeof (data as { close?: unknown }).close !== "boolean") return { success: false as const, error: "invalid close friend" };
    return { success: true as const, data: { close: (data as { close: boolean }).close } };
  },
};

export function withSocial<TBase extends ApiMixin>(Base: TBase) {
  return class SocialEndpoints extends Base {
    listFriends(): Promise<Friend[]> {
      return this.request("/friends", FriendSchema.array());
    }

    /** People the viewer marked close. Adding someone is limited to followers; this list is whoever is marked now. */
    listCloseFriends(): Promise<Friend[]> {
      return this.request("/friends/close", FriendSchema.array());
    }

    getCloseFriend(userId: string): Promise<boolean> {
      return this.request(`/users/${encodeURIComponent(userId)}/close`, CloseFriendSchema).then((row) => row.close);
    }

    setCloseFriend(userId: string, close: boolean): Promise<boolean> {
      return this.request(`/users/${encodeURIComponent(userId)}/close`, CloseFriendSchema, { method: "PUT", body: { close } }).then((row) => row.close);
    }

    getFriendsActivity(userId: string): Promise<FriendActivityByFriend[]> {
      return this.request(`/friends/activity?userId=${encodeURIComponent(userId)}`, FriendActivityByFriendSchema.array());
    }

    getFriendAvailability(eventId: string): Promise<FriendAvailability[]> {
      return this.request(`/friends/availability?eventId=${encodeURIComponent(eventId)}`, FriendAvailabilitySchema.array());
    }

    /** When the MAX contact list was last pulled in; the «Синхронизировано …» line of экран 26 reads from it. */
    getFriendsSync(): Promise<FriendsSync> {
      return this.request("/friends/sync", FriendsSyncSchema);
    }

    /** Re-read the MAX contacts into the friend graph and answer with the graph that came out of it. */
    syncFriends(): Promise<Friend[]> {
      return this.request("/friends/sync", FriendSchema.array(), { method: "POST" });
    }

    /** People the onboarding friends step offers to follow, with their hint line and current follow state. */
    listFriendSuggestions(): Promise<FriendSuggestion[]> {
      return this.request("/friends/suggestions", FriendSuggestionListSchema);
    }

    /** Replace the set of people the viewer follows; the answer is the set that was stored. */
    followFriends(userIds: string[]): Promise<string[]> {
      return this.request("/friends/follows", FollowedIdsSchema, { method: "PUT", body: { userIds } });
    }

    /**
     * People this person follows — one half of the two header counters of экран 36. Following a person
     * is not a `Subscription` (#501) and lives in the follow set POST /friends/follows writes, so the
     * profile reads it here and not through listSubscriptions.
     */
    listFollowing(userId: string): Promise<Friend[]> {
      return this.request(`/users/${encodeURIComponent(userId)}/following`, FriendSchema.array());
    }

    /**
     * People who follow this person. The backend keeps no reverse direction at all — subscriptions are
     * organizer/place/interest, and the follow set is write-only from the onboarding step — so this is
     * the path and the shape the endpoint will take, mock-backed meanwhile.
     */
    listFollowers(userId: string): Promise<Friend[]> {
      return this.request(`/users/${encodeURIComponent(userId)}/followers`, FriendSchema.array());
    }

    createGathering(payload: CreateGathering): Promise<Gathering> {
      return this.request("/gatherings", GatheringSchema, { body: payload });
    }

    getGathering(id: string): Promise<Gathering> {
      return this.request(`/gatherings/${id}`, GatheringSchema);
    }

    respondToGathering(gatheringId: string, response: InviteeResponse): Promise<Gathering> {
      return this.request(`/gatherings/${gatheringId}/response`, GatheringSchema, { method: "PATCH", body: { response } });
    }

    listMicroEvents(): Promise<MicroEvent[]> {
      return this.request("/micro-events", MicroEventSchema.array());
    }

    /**
     * One micro-event with its venue and the names behind its participant ids (макет, экран 25). A
     * server that answers the list but not a single gathering gets the card assembled from that list
     * (microEventCardFrom), so «такого сбора больше нет» keeps meaning what it says.
     */
    async getMicroEventCard(id: string): Promise<MicroEventCard> {
      try {
        return await this.request(`/micro-events/${encodeURIComponent(id)}`, MicroEventCardSchema);
      } catch (error) {
        if (!isEndpointMissing(error)) throw error;
        const [events, places, friends] = await Promise.all([this.request("/micro-events", MicroEventSchema.array()), this.request("/places", PlaceSchema.array()), this.request("/friends", FriendSchema.array())]);
        const card = microEventCardFrom(id, events, places, friends);
        if (card === null) throw error;
        return card;
      }
    }

    createMicroEvent(payload: CreateMicroEvent): Promise<MicroEvent> {
      return this.request("/micro-events", MicroEventSchema, { body: payload });
    }

    /** Join a micro-event; the userId param is ignored server-side, identity comes from initData. */
    joinMicroEvent(id: string, userId: string): Promise<MicroEvent> {
      return this.request(`/micro-events/${id}/join?userId=${encodeURIComponent(userId)}`, MicroEventSchema, { method: "POST" });
    }

    /** Leave a micro-event; the userId param is ignored server-side, identity comes from initData. */
    leaveMicroEvent(id: string, userId: string): Promise<MicroEvent> {
      return this.request(`/micro-events/${id}/join?userId=${encodeURIComponent(userId)}`, MicroEventSchema, { method: "DELETE" });
    }

    /** Shared expenses of a gathering. userId is for the mock; the server reads the signed-in user. */
    getMicroEventBudget(id: string, userId: string): Promise<MicroBudget> {
      return this.request(`/micro-events/${id}/budget?userId=${encodeURIComponent(userId)}`, MicroBudgetSchema);
    }

    addMicroEventExpense(id: string, userId: string, payload: CreatePlanExpenseWrite): Promise<MicroBudget> {
      return this.request(`/micro-events/${id}/expenses?userId=${encodeURIComponent(userId)}`, MicroBudgetSchema, { method: "POST", body: payload });
    }

    getDiscovery(): Promise<DiscoveryScreen> {
      return this.request("/discovery", DiscoveryScreenSchema);
    }

    /** The «друзья были здесь» map layer: places friends checked in at, the viewer's own visits included. */
    listFriendPlaces(): Promise<FriendPlaceVisit[]> {
      return this.request("/discovery/friend-places", FriendPlaceVisitSchema.array());
    }

    getFriendRoute(userId: string): Promise<FriendRouteScreen> {
      return this.request(`/discovery/friends/${encodeURIComponent(userId)}/route`, FriendRouteScreenSchema);
    }

    getPeople(origin: { latitude: number; longitude: number } | null = null): Promise<PeopleResponse> {
      const query = origin === null ? "" : `?${new URLSearchParams({ lat: String(origin.latitude), lng: String(origin.longitude) }).toString()}`;
      return this.request(`/people${query}`, PeopleResponseSchema);
    }
  };
}
