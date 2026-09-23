// START_MODULE_CONTRACT
// PURPOSE: Social graph endpoints of the api client: friends, the gathering flow, UGC micro-events, reverse discovery and people matching.
// SCOPE: GET /friends[/activity|/availability], the /gatherings surface, the /micro-events surface, GET /discovery[/friend-places|/friends/:userId/route], GET /people.
// DEPENDS: ./transport.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CreateGathering - gathering launch payload (event + friend ids + proposed meeting time)
// - CreateMicroEvent - micro-event creation payload (author, what/when/where, limit)
// - FriendSuggestion - one person of the onboarding friends step: friend + the hint line under the name + whether the viewer follows them
// - withSocial - ApiClient.listFriends / getFriendsActivity / getFriendAvailability / listFriendSuggestions / followFriends / createGathering / getGathering / respondToGathering / listMicroEvents / createMicroEvent / joinMicroEvent / leaveMicroEvent / getDiscovery / listFriendPlaces / getFriendRoute / getPeople
// END_MODULE_MAP

import { DiscoveryResponseSchema, FriendActivityByFriendSchema, FriendAvailabilitySchema, FriendPlaceVisitSchema, FriendRouteSchema, FriendSchema, GatheringSchema, MicroEventSchema, PeopleResponseSchema } from "@max-events/api-contracts";
import type { DiscoveryResponse, Friend, FriendActivityByFriend, FriendAvailability, FriendPlaceVisit, FriendRoute, Gathering, InviteeResponse, MicroEvent, PeopleResponse } from "@max-events/api-contracts";
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

export function withSocial<TBase extends ApiMixin>(Base: TBase) {
  return class SocialEndpoints extends Base {
    listFriends(): Promise<Friend[]> {
      return this.request("/friends", FriendSchema.array());
    }

    getFriendsActivity(userId: string): Promise<FriendActivityByFriend[]> {
      return this.request(`/friends/activity?userId=${encodeURIComponent(userId)}`, FriendActivityByFriendSchema.array());
    }

    getFriendAvailability(eventId: string): Promise<FriendAvailability[]> {
      return this.request(`/friends/availability?eventId=${encodeURIComponent(eventId)}`, FriendAvailabilitySchema.array());
    }

    /** People the onboarding friends step offers to follow, with their hint line and current follow state. */
    listFriendSuggestions(): Promise<FriendSuggestion[]> {
      return this.request("/friends/suggestions", FriendSuggestionListSchema);
    }

    /** Replace the set of people the viewer follows; the answer is the set that was stored. */
    followFriends(userIds: string[]): Promise<string[]> {
      return this.request("/friends/follows", FollowedIdsSchema, { method: "PUT", body: { userIds } });
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

    getDiscovery(): Promise<DiscoveryResponse> {
      return this.request("/discovery", DiscoveryResponseSchema);
    }

    /** The «друзья были здесь» map layer: places friends checked in at, the viewer's own visits included. */
    listFriendPlaces(): Promise<FriendPlaceVisit[]> {
      return this.request("/discovery/friend-places", FriendPlaceVisitSchema.array());
    }

    getFriendRoute(userId: string): Promise<FriendRoute> {
      return this.request(`/discovery/friends/${encodeURIComponent(userId)}/route`, FriendRouteSchema);
    }

    getPeople(origin: { latitude: number; longitude: number } | null = null): Promise<PeopleResponse> {
      const query = origin === null ? "" : `?${new URLSearchParams({ lat: String(origin.latitude), lng: String(origin.longitude) }).toString()}`;
      return this.request(`/people${query}`, PeopleResponseSchema);
    }
  };
}
