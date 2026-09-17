import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { CreateGathering, FriendAvailability, Gathering } from "@max-events/api-contracts";
import { UserEntity } from "../users/user.entity";
import { FriendAvailabilityController, GatheringsController } from "./gatherings.controller";
import type { GatheringsService } from "./gatherings.service";

const user = { id: "00000000-0000-4000-8000-00000000000a" } as UserEntity;
const eventId = "00000000-0000-4000-8000-0000000000e1";
const gathering = { id: "00000000-0000-4000-8000-0000000000g1" } as Gathering;
const availability: FriendAvailability[] = [];

function createService() {
  const calls: { availability?: { userId: string; eventId: string }; create?: CreateGathering; respond?: { userId: string; id: string; response: string } } = {};
  const service = {
    availability: async (userId: string, bookedEventId: string) => {
      calls.availability = { userId, eventId: bookedEventId };
      return availability;
    },
    create: async (_userId: string, payload: CreateGathering) => {
      calls.create = payload;
      return gathering;
    },
    get: async () => gathering,
    respond: async (userId: string, id: string, response: "accepted" | "considering" | "busy") => {
      calls.respond = { userId, id, response };
      return gathering;
    },
  } as unknown as GatheringsService;
  return { calls, service };
}

describe("FriendAvailabilityController", () => {
  it("rejects a missing eventId and forwards a uuid", async () => {
    const { calls, service } = createService();
    const controller = new FriendAvailabilityController(service);
    await expect(controller.availability(user, undefined)).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.availability(user, eventId)).resolves.toEqual(availability);
    expect(calls.availability).toEqual({ userId: user.id, eventId });
  });
});

describe("GatheringsController", () => {
  it("rejects an invalid body and creates a valid gathering", async () => {
    const { calls, service } = createService();
    const controller = new GatheringsController(service);
    await expect(controller.create(user, {})).rejects.toBeInstanceOf(BadRequestException);
    const payload = { eventId, friendIds: ["00000000-0000-4000-8000-0000000000b1"], proposedMeetingAt: "2026-09-20T15:30:00.000Z" };
    await expect(controller.create(user, payload)).resolves.toEqual(gathering);
    expect(calls.create).toEqual(payload);
    await expect(controller.respond(user, gathering.id, { response: "accepted" })).resolves.toEqual(gathering);
    expect(calls.respond).toEqual({ userId: user.id, id: gathering.id, response: "accepted" });
  });
});
