import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { CheckIn, VisitStats } from "@max-events/api-contracts";
import { UserEntity } from "../users/user.entity";
import { CheckInsController, VisitStatsController } from "./check-ins.controller";
import type { CheckInsService } from "./check-ins.service";

const user = { id: "00000000-0000-4000-8000-00000000000a" } as UserEntity;
const checkIn = { id: "00000000-0000-4000-8000-0000000000c1", userId: user.id, eventId: "00000000-0000-4000-8000-0000000000e1", placeId: null } as CheckIn;
const stats = { userId: user.id, placesCount: 0, eventsCount: 0, districtsCount: 0, byCategory: [] } as VisitStats;

function createService() {
  const calls: { create?: unknown; stats?: { userId: string; requesterId: string } } = {};
  const service = {
    create: async (_userId: string, payload: unknown) => {
      calls.create = payload;
      return checkIn;
    },
    stats: async (userId: string, requesterId: string) => {
      calls.stats = { userId, requesterId };
      return stats;
    },
  } as unknown as CheckInsService;
  return { calls, service };
}

describe("CheckInsController", () => {
  it("rejects both or neither target and creates from eventId", async () => {
    const { calls, service } = createService();
    const controller = new CheckInsController(service);
    await expect(controller.create(user, {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.create(user, { eventId: checkIn.eventId, placeId: "00000000-0000-4000-8000-0000000000p1" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.create(user, { userId: user.id, eventId: checkIn.eventId })).resolves.toEqual(checkIn);
    expect(calls.create).toEqual({ eventId: checkIn.eventId });
  });
});

describe("VisitStatsController", () => {
  it("forwards the path user id and the authenticated user", async () => {
    const { calls, service } = createService();
    const controller = new VisitStatsController(service);
    await expect(controller.stats(user, user.id)).resolves.toEqual(stats);
    expect(calls.stats).toEqual({ userId: user.id, requesterId: user.id });
  });
});
