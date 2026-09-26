import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { UserEntity } from "../users/user.entity";
import { PlaceParticipationsController } from "./place-participations.controller";
import type { PlaceParticipationsService } from "./place-participations.service";

const user = { id: "00000000-0000-4000-8000-00000000000a" } as UserEntity;
const placeId = "00000000-0000-4000-8000-0000000000a1";

describe("PlaceParticipationsController", () => {
  it("forwards a status write and a clear", async () => {
    const calls: Array<{ placeId: string; status: string | null }> = [];
    const service = {
      set: async (_userId: string, id: string, status: string | null) => {
        calls.push({ placeId: id, status });
        return { placeId: id, status };
      },
    } as unknown as PlaceParticipationsService;
    const controller = new PlaceParticipationsController(service);
    await expect(controller.set(user, placeId, { status: "going" })).resolves.toEqual({ placeId, status: "going" });
    await expect(controller.set(user, placeId, { status: null })).resolves.toEqual({ placeId, status: null });
    expect(calls).toEqual([
      { placeId, status: "going" },
      { placeId, status: null },
    ]);
  });

  it("rejects a body without a status", async () => {
    const controller = new PlaceParticipationsController({ set: async () => ({ placeId, status: null }) } as unknown as PlaceParticipationsService);
    await expect(controller.set(user, placeId, {})).rejects.toBeInstanceOf(BadRequestException);
  });
});
