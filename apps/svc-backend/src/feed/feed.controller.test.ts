import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { FeedPost } from "@max-events/api-contracts";
import { UserEntity } from "../users/user.entity";
import { FeedController } from "./feed.controller";
import type { FeedListFilter, FeedService } from "./feed.service";

const user = { id: "00000000-0000-4000-8000-00000000000a" } as UserEntity;
const eventId = "00000000-0000-4000-8000-0000000000e1";
const placeId = "00000000-0000-4000-8000-0000000000a1";

function createController() {
  const calls: Array<{ filter: FeedListFilter; limit: number; offset: number }> = [];
  let cardsFor: string | undefined;
  const feed = {
    list: async (_viewerId: string, filter: FeedListFilter, limit: number, offset: number) => {
      calls.push({ filter, limit, offset });
      return [] as FeedPost[];
    },
    listCards: async (viewerId: string) => {
      cardsFor = viewerId;
      return [];
    },
    saveDraft: async (viewerId: string, payload: { text: string }) => ({ savedAt: "2026-09-12T10:00:00.000Z", viewerId, text: payload.text }),
    join: async (viewerId: string, postId: string) => ({ id: postId, userId: viewerId, eventId, status: "active", source: "feed" }),
  } as unknown as FeedService;
  return {
    controller: new FeedController(feed),
    calls,
    get cardsFor() {
      return cardsFor;
    },
  };
}

describe("FeedController.list", () => {
  it("passes an event wall through with the default page window", async () => {
    const { controller, calls } = createController();
    await controller.list(user, eventId);
    expect(calls[0]?.filter).toEqual({ eventId, placeId: undefined });
    expect(calls[0]).toMatchObject({ limit: 50, offset: 0 });
  });

  it("passes a place wall through", async () => {
    const { controller, calls } = createController();
    await controller.list(user, undefined, placeId, "10", "20");
    expect(calls[0]?.filter).toEqual({ eventId: undefined, placeId });
    expect(calls[0]).toMatchObject({ limit: 10, offset: 20 });
  });

  it("rejects a malformed id, a negative page window and both walls at once", () => {
    const { controller } = createController();
    // The query is validated before the service is reached, so these throw rather than reject.
    expect(() => controller.list(user, "not-an-id")).toThrow(BadRequestException);
    expect(() => controller.list(user, undefined, "not-an-id")).toThrow(BadRequestException);
    expect(() => controller.list(user, eventId, placeId)).toThrow(BadRequestException);
    expect(() => controller.list(user, eventId, undefined, "0")).toThrow(BadRequestException);
    expect(() => controller.list(user, eventId, undefined, "10", "-1")).toThrow(BadRequestException);
  });
});

describe("FeedController.saveDraft", () => {
  it("rejects a draft without eventId and forwards a valid one", async () => {
    const { controller } = createController();
    await expect(controller.saveDraft(user, { text: "x" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.saveDraft(user, { eventId: null, text: "черновик" })).resolves.toMatchObject({ savedAt: "2026-09-12T10:00:00.000Z" });
  });
});

describe("FeedController.listCards", () => {
  it("asks the service for the current user's home cards", async () => {
    const created = createController();
    await expect(created.controller.listCards(user)).resolves.toEqual([]);
    expect(created.cardsFor).toBe(user.id);
  });
});
