import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { CreateVoteWrite, Vote } from "@max-events/api-contracts";
import { UserEntity } from "../users/user.entity";
import { VotesController } from "./votes.controller";
import type { VotesService } from "./votes.service";

const user = { id: "00000000-0000-4000-8000-00000000000a" } as UserEntity;
const voteId = "00000000-0000-4000-8000-0000000000c1";
const eventId = "00000000-0000-4000-8000-0000000000e1";
const vote = { id: voteId, title: "Куда идем в пятницу?", winnerEventId: null } as Vote;

describe("VotesController", () => {
  it("creates a vote and casts a ballot", async () => {
    const calls: { create?: CreateVoteWrite; ballot?: string } = {};
    const service = {
      list: async () => [vote],
      create: async (_userId: string, payload: CreateVoteWrite) => {
        calls.create = payload;
        return vote;
      },
      get: async () => vote,
      castBallot: async (_userId: string, _id: string, event: string) => {
        calls.ballot = event;
        return { ...vote, winnerEventId: event };
      },
    } as unknown as VotesService;
    const controller = new VotesController(service);
    await expect(controller.create(user, { eventIds: [eventId] })).rejects.toBeInstanceOf(BadRequestException);
    const created = await controller.create(user, {
      eventIds: [eventId, "00000000-0000-4000-8000-0000000000e2"],
      participantIds: ["00000000-0000-4000-8000-0000000000b1"],
    });
    expect(created.id).toBe(voteId);
    expect(calls.create?.title).toBe("Куда идем в пятницу?");
    await expect(controller.cast(user, voteId, {})).rejects.toBeInstanceOf(BadRequestException);
    const cast = await controller.cast(user, voteId, { eventId });
    expect(cast.winnerEventId).toBe(eventId);
    expect(calls.ballot).toBe(eventId);
  });
});
