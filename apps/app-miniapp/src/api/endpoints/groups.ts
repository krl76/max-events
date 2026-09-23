// START_MODULE_CONTRACT
// PURPOSE: Group endpoints of the api client: the «Мы» group lifecycle and the shared event vote.
// SCOPE: POST/GET /we-groups[/:id[/events|/places|/archive]], POST/GET /votes[/:id[/ballots|/close]]; WeGroupCard and VoteScreen are client-side aggregates like EventDetails in ./catalog.ts — the fields the design needs and the DTOs do not carry yet.
// DEPENDS: ./transport.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - WeGroupCard - group screen plus the two aggregates экраны 30 и 31 print and the DTO has no column for: the agreed budget ceiling and the full photo count
// - VoteStatus - open while ballots are taken, closed once the host finished the vote (макет, экран 33)
// - VoteScreen - vote plus the poll roster by name, who has already voted and whether the vote is finished
// - withGroups - ApiClient.createWeGroup / listWeGroups / getWeGroup / addWeGroupEvent / addWeGroupPlace / archiveWeGroup / createVote / getVote / castBallot / closeVote
// END_MODULE_MAP

import { FriendSchema, VoteSchema, WeGroupScreenSchema } from "@max-events/api-contracts";
import type { CreateVoteWrite, CreateWeGroupWrite, Friend, Vote, WeGroupScreen } from "@max-events/api-contracts";
import type { ApiMixin, ZodSchema } from "./transport";

/**
 * Screen aggregate of экраны 30 и 31. The WeGroupScreen DTO already carries the six blocks of the
 * design (members, events, places, bookings, route, budget, photos); these two fields are what the
 * design prints on top of them and the backend has no column for:
 *
 * - `budgetLimitRub` is the sum the company agreed on («потрачено 9 800 из 14 200 ₽»). PlanBudget
 *   only knows what was already spent, so «свободно» cannot be computed from it.
 * - `photosTotal` is how many photos the group has in all («Все 62»); `photos` is the grid preview.
 *
 * Both are nullable-by-absence on purpose: a server that predates them answers the screen as it does
 * today and the blocks simply do not render.
 */
export interface WeGroupCard extends WeGroupScreen {
  budgetLimitRub: number | null;
  photosTotal: number;
}

function parseWeGroupCard(raw: unknown): WeGroupCard | null {
  const screen = WeGroupScreenSchema.safeParse(raw);
  if (!screen.success) return null;
  const extra = raw as Record<string, unknown>;
  const budgetLimitRub = typeof extra.budgetLimitRub === "number" ? extra.budgetLimitRub : null;
  const photosTotal = typeof extra.photosTotal === "number" ? extra.photosTotal : screen.data.photos.length;
  return { ...screen.data, budgetLimitRub, photosTotal };
}

const WeGroupCardSchema: ZodSchema<WeGroupCard> = {
  safeParse(data: unknown) {
    const card = parseWeGroupCard(data);
    if (card === null) return { success: false as const, error: "invalid we-group screen" };
    return { success: true as const, data: card };
  },
};

const WeGroupCardsSchema: ZodSchema<WeGroupCard[]> = {
  safeParse(data: unknown) {
    if (!Array.isArray(data)) return { success: false as const, error: "expected a we-group screen array" };
    const cards: WeGroupCard[] = [];
    for (const item of data) {
      const card = parseWeGroupCard(item);
      if (card === null) return { success: false as const, error: "invalid we-group screen" };
      cards.push(card);
    }
    return { success: true as const, data: cards };
  },
};

/** Ballots are taken while the vote is open; the host closes it and the leader becomes the winner (макет, экран 33). */
export type VoteStatus = "open" | "closed";

/**
 * Screen aggregate of экран 33. The Vote DTO counts ballots per option and names the participants,
 * but the screen also has to say «Проголосовали 4 из 5» and «Ксения ещё не голосовала», and it has a
 * «Завершить» button — none of which the vote domain models:
 *
 * - `voters` is the poll roster by name, host first; `participants` leaves the host out, so without
 *   it the screen cannot name everyone who may vote.
 * - `votedUserIds` is the per-person breakdown behind «ещё не голосовала».
 * - `status`/`closedAt` is the finished vote; the backend has no transition into it.
 *
 * A server that answers today's Vote still renders: the roster falls back to the participants, the
 * breakdown to «никто пока», and the vote reads as open.
 */
export interface VoteScreen extends Vote {
  status: VoteStatus;
  closedAt: string | null;
  voters: Friend[];
  votedUserIds: string[];
}

function parseVoteScreen(raw: unknown): VoteScreen | null {
  const vote = VoteSchema.safeParse(raw);
  if (!vote.success) return null;
  const extra = raw as Record<string, unknown>;
  const closedAt = typeof extra.closedAt === "string" ? extra.closedAt : null;
  const votedUserIds = Array.isArray(extra.votedUserIds) ? extra.votedUserIds.filter((id): id is string => typeof id === "string") : [];
  const roster = Array.isArray(extra.voters) ? extra.voters.map((item) => FriendSchema.safeParse(item)) : [];
  const voters = roster.every((parsed) => parsed.success) && roster.length > 0 ? roster.map((parsed) => (parsed.success ? parsed.data : null)).filter((friend): friend is Friend => friend !== null) : vote.data.participants;
  return { ...vote.data, status: extra.status === "closed" ? "closed" : "open", closedAt, voters, votedUserIds };
}

const VoteScreenSchema: ZodSchema<VoteScreen> = {
  safeParse(data: unknown) {
    const screen = parseVoteScreen(data);
    if (screen === null) return { success: false as const, error: "invalid vote screen" };
    return { success: true as const, data: screen };
  },
};

export function withGroups<TBase extends ApiMixin>(Base: TBase) {
  return class GroupEndpoints extends Base {
    createWeGroup(payload: CreateWeGroupWrite): Promise<WeGroupCard> {
      return this.request("/we-groups", WeGroupCardSchema, { body: payload });
    }

    listWeGroups(): Promise<WeGroupCard[]> {
      return this.request("/we-groups", WeGroupCardsSchema);
    }

    getWeGroup(id: string): Promise<WeGroupCard> {
      return this.request(`/we-groups/${id}`, WeGroupCardSchema);
    }

    addWeGroupEvent(id: string, eventId: string): Promise<WeGroupCard> {
      return this.request(`/we-groups/${id}/events`, WeGroupCardSchema, { body: { eventId } });
    }

    addWeGroupPlace(id: string, placeId: string): Promise<WeGroupCard> {
      return this.request(`/we-groups/${id}/places`, WeGroupCardSchema, { body: { placeId } });
    }

    archiveWeGroup(id: string): Promise<WeGroupCard> {
      return this.request(`/we-groups/${id}/archive`, WeGroupCardSchema, { method: "POST" });
    }

    createVote(payload: CreateVoteWrite): Promise<VoteScreen> {
      return this.request("/votes", VoteScreenSchema, { body: payload });
    }

    getVote(id: string): Promise<VoteScreen> {
      return this.request(`/votes/${id}`, VoteScreenSchema);
    }

    castBallot(voteId: string, eventId: string): Promise<VoteScreen> {
      return this.request(`/votes/${voteId}/ballots`, VoteScreenSchema, { body: { eventId } });
    }

    /** Finishes the vote: the leader becomes the winner and no more ballots are taken. Host only, mock-backed — the votes domain has no closed state at all. */
    closeVote(voteId: string): Promise<VoteScreen> {
      return this.request(`/votes/${voteId}/close`, VoteScreenSchema, { method: "POST" });
    }
  };
}
