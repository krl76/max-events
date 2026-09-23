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
// - withSocial - ApiClient.listFriends / getFriendsActivity / getFriendAvailability / createGathering / getGathering / respondToGathering / listMicroEvents / createMicroEvent / joinMicroEvent / leaveMicroEvent / getDiscovery / listFriendPlaces / getFriendRoute / getPeople
// END_MODULE_MAP

import { DiscoveryResponseSchema, FriendActivityByFriendSchema, FriendAvailabilitySchema, FriendPlaceVisitSchema, FriendRouteSchema, FriendSchema, GatheringSchema, MicroEventSchema, PeopleResponseSchema } from "@max-events/api-contracts";
import type { DiscoveryResponse, Friend, FriendActivityByFriend, FriendAvailability, FriendPlaceVisit, FriendRoute, Gathering, InviteeResponse, MicroEvent, PeopleResponse } from "@max-events/api-contracts";
import type { ApiMixin } from "./transport";

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
