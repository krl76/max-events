import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { CreatePlanWrite, PlanCard } from "@max-events/api-contracts";
import { UserEntity } from "../users/user.entity";
import { parseOrigin, PlansController } from "./plans.controller";
import type { GeoOrigin, PlansService } from "./plans.service";

const user = { id: "00000000-0000-4000-8000-00000000000a" } as UserEntity;
const planId = "00000000-0000-4000-8000-0000000000c1";
const card = { plan: { id: planId }, distanceMeters: 0 } as PlanCard;

function createController() {
  const calls: { create?: CreatePlanWrite; origin?: GeoOrigin | null; respond?: string } = {};
  const service = {
    list: async (_userId: string, origin: GeoOrigin | null) => {
      calls.origin = origin;
      return [card];
    },
    create: async (_userId: string, payload: CreatePlanWrite) => {
      calls.create = payload;
      return card;
    },
    get: async () => card,
    remove: async () => undefined,
    addParticipant: async () => card,
    addExpense: async () => ({ expenses: [], perPerson: [], debts: [], totalRub: 0 }),
    getBudget: async () => ({ expenses: [], perPerson: [], debts: [], totalRub: 0 }),
    respond: async (_userId: string, _id: string, status: string) => {
      calls.respond = status;
      return card;
    },
  } as unknown as PlansService;
  return { calls, controller: new PlansController(service) };
}

describe("parseOrigin", () => {
  it("returns null when omitted and 400 when invalid", () => {
    expect(parseOrigin({})).toBeNull();
    expect(() => parseOrigin({ lat: "55" })).toThrow(BadRequestException);
    expect(parseOrigin({ lat: "55.7", lng: "37.6" })).toEqual({ latitude: 55.7, longitude: 37.6 });
  });
});

describe("PlansController", () => {
  it("rejects an invalid create body and forwards a valid one", async () => {
    const { calls, controller } = createController();
    await expect(controller.create(user, {})).rejects.toBeInstanceOf(BadRequestException);
    const payload = {
      eventId: "00000000-0000-4000-8000-0000000000e1",
      participantIds: ["00000000-0000-4000-8000-0000000000b1"],
      meetingPoint: "у метро",
      meetingAt: "2026-09-20T15:20:00.000Z",
    };
    await expect(controller.create(user, payload)).resolves.toEqual(card);
    expect(calls.create).toEqual(payload);
    await expect(controller.respond(user, planId, { status: "confirmed" })).resolves.toEqual(card);
    expect(calls.respond).toBe("confirmed");
    await expect(controller.list(user, { lat: "55.7", lng: "37.6" })).resolves.toEqual([card]);
    expect(calls.origin).toEqual({ latitude: 55.7, longitude: 37.6 });
    await expect(controller.addExpense(user, planId, {})).rejects.toBeInstanceOf(BadRequestException);
  });
});
