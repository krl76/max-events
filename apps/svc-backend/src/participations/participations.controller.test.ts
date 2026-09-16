import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { Participation, ParticipationStats } from "@max-events/api-contracts";
import { UserEntity } from "../users/user.entity";
import { ParticipationsController } from "./participations.controller";
import type { ParticipationsService } from "./participations.service";

const user = { id: "00000000-0000-4000-8000-00000000000a" } as UserEntity;
const eventId = "00000000-0000-4000-8000-0000000000e1";
const participation: Participation = {
  id: "00000000-0000-4000-8000-0000000000p1",
  userId: user.id,
  eventId,
  status: "going",
  createdAt: "2026-09-01T07:00:00.000Z",
  updatedAt: "2026-09-01T07:00:00.000Z",
};
const stats: ParticipationStats = {
  counts: {
    wants_to_go: 0,
    probably_going: 0,
    going: 1,
    looking_for_company: 0,
    looking_for_travel_buddy: 0,
    looking_for_after_event_company: 0,
  },
  friendsCount: 0,
  myStatus: "going",
};

function createController() {
  const calls: { set?: { userId: string; eventId: string; status: string }; stats?: { userId: string; eventId: string }; getMine?: { userId: string; eventId: string }; remove?: { userId: string; eventId: string } } = {};
  const service = {
    set: async (userId: string, bookedEventId: string, status: Participation["status"]) => {
      calls.set = { userId, eventId: bookedEventId, status };
      return { ...participation, status };
    },
    stats: async (userId: string, bookedEventId: string) => {
      calls.stats = { userId, eventId: bookedEventId };
      return stats;
    },
    getMine: async (userId: string, bookedEventId: string) => {
      calls.getMine = { userId, eventId: bookedEventId };
      return participation;
    },
    remove: async (userId: string, bookedEventId: string) => {
      calls.remove = { userId, eventId: bookedEventId };
      return participation;
    },
  } as unknown as ParticipationsService;
  return { calls, controller: new ParticipationsController(service) };
}

describe("ParticipationsController", () => {
  it("rejects an invalid status body", async () => {
    const { controller } = createController();
    await expect(controller.set(user, eventId, { status: "confirmed" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.set(user, eventId, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it("sets, reads, stats, and deletes using the authenticated user", async () => {
    const { calls, controller } = createController();
    await expect(controller.set(user, eventId, { status: "going" })).resolves.toMatchObject({ status: "going" });
    expect(calls.set).toEqual({ userId: user.id, eventId, status: "going" });

    await expect(controller.stats(user, eventId)).resolves.toEqual(stats);
    expect(calls.stats).toEqual({ userId: user.id, eventId });

    await expect(controller.getMine(user, eventId)).resolves.toEqual(participation);
    expect(calls.getMine).toEqual({ userId: user.id, eventId });

    await expect(controller.remove(user, eventId)).resolves.toEqual(participation);
    expect(calls.remove).toEqual({ userId: user.id, eventId });
  });
});
