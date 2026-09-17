import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { ListItem, ListSummary } from "@max-events/api-contracts";
import { UserEntity } from "../users/user.entity";
import { ListsController } from "./lists.controller";
import type { ListsService } from "./lists.service";

const user = { id: "00000000-0000-4000-8000-00000000000a" } as UserEntity;
const listId = "00000000-0000-4000-8000-0000000000c1";
const eventId = "00000000-0000-4000-8000-0000000000e1";
const item = { id: "00000000-0000-4000-8000-0000000000i1", listId, eventId, placeId: null } as ListItem;
const summaries = [] as ListSummary[];

function createController() {
  const calls: { list?: { userId: string; eventId: string | null }; add?: { listId: string; eventId: string } } = {};
  const service = {
    list: async (userId: string, eventId: string | null) => {
      calls.list = { userId, eventId };
      return summaries;
    },
    get: async () => ({ list: { id: listId }, participants: [], items: [] }),
    itemsFor: async () => [],
    addEvent: async (_userId: string, id: string, bookedEventId: string) => {
      calls.add = { listId: id, eventId: bookedEventId };
      return item;
    },
    removeItem: async () => item,
  } as unknown as ListsService;
  return { calls, controller: new ListsController(service) };
}

describe("ListsController", () => {
  it("rejects an invalid eventId query and forwards a valid one", async () => {
    const { calls, controller } = createController();
    await expect(controller.list(user, "not-a-uuid")).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.list(user, eventId)).resolves.toEqual(summaries);
    expect(calls.list).toEqual({ userId: user.id, eventId });
  });

  it("adds an event from the body eventId and rejects a missing one", async () => {
    const { calls, controller } = createController();
    await expect(controller.add(user, listId, {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.add(user, listId, { userId: user.id, eventId })).resolves.toEqual(item);
    expect(calls.add).toEqual({ listId, eventId });
  });
});
