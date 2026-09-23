// START_MODULE_CONTRACT
// PURPOSE: Group endpoints of the api client: the «Мы» group lifecycle and the shared event vote.
// SCOPE: POST/GET /we-groups[/:id[/events|/places|/archive]], POST/GET /votes[/:id[/ballots]].
// DEPENDS: ./transport.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - withGroups - ApiClient.createWeGroup / listWeGroups / getWeGroup / addWeGroupEvent / addWeGroupPlace / archiveWeGroup / createVote / getVote / castBallot
// END_MODULE_MAP

import { VoteSchema, WeGroupScreenSchema } from "@max-events/api-contracts";
import type { CreateVoteWrite, CreateWeGroupWrite, Vote, WeGroupScreen } from "@max-events/api-contracts";
import type { ApiMixin } from "./transport";

export function withGroups<TBase extends ApiMixin>(Base: TBase) {
  return class GroupEndpoints extends Base {
    createWeGroup(payload: CreateWeGroupWrite): Promise<WeGroupScreen> {
      return this.request("/we-groups", WeGroupScreenSchema, { body: payload });
    }

    listWeGroups(): Promise<WeGroupScreen[]> {
      return this.request("/we-groups", WeGroupScreenSchema.array());
    }

    getWeGroup(id: string): Promise<WeGroupScreen> {
      return this.request(`/we-groups/${id}`, WeGroupScreenSchema);
    }

    addWeGroupEvent(id: string, eventId: string): Promise<WeGroupScreen> {
      return this.request(`/we-groups/${id}/events`, WeGroupScreenSchema, { body: { eventId } });
    }

    addWeGroupPlace(id: string, placeId: string): Promise<WeGroupScreen> {
      return this.request(`/we-groups/${id}/places`, WeGroupScreenSchema, { body: { placeId } });
    }

    archiveWeGroup(id: string): Promise<WeGroupScreen> {
      return this.request(`/we-groups/${id}/archive`, WeGroupScreenSchema, { method: "POST" });
    }

    createVote(payload: CreateVoteWrite): Promise<Vote> {
      return this.request("/votes", VoteSchema, { body: payload });
    }

    getVote(id: string): Promise<Vote> {
      return this.request(`/votes/${id}`, VoteSchema);
    }

    castBallot(voteId: string, eventId: string): Promise<Vote> {
      return this.request(`/votes/${voteId}/ballots`, VoteSchema, { body: { eventId } });
    }
  };
}
