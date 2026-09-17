import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { CreateSubscription, Subscription } from "@max-events/api-contracts";
import { UserEntity } from "../users/user.entity";
import { SubscriptionsController } from "./subscriptions.controller";
import type { SubscriptionsService } from "./subscriptions.service";

const user = { id: "00000000-0000-4000-8000-00000000000a" } as UserEntity;
const subscription = { id: "00000000-0000-4000-8000-0000000000s1", type: "interest", interest: "походы" } as Subscription;

function createController() {
  const calls: { create?: CreateSubscription } = {};
  const service = {
    list: async () => [subscription],
    create: async (_userId: string, payload: CreateSubscription) => {
      calls.create = payload;
      return subscription;
    },
    remove: async () => subscription,
  } as unknown as SubscriptionsService;
  return { calls, controller: new SubscriptionsController(service) };
}

describe("SubscriptionsController", () => {
  it("rejects an invalid body and creates a valid interest subscription", async () => {
    const { calls, controller } = createController();
    await expect(controller.create(user, { type: "place" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.create(user, { type: "interest", interest: "походы" })).resolves.toEqual(subscription);
    expect(calls.create).toEqual({ type: "interest", interest: "походы" });
  });
});
