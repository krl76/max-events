import { afterEach, describe, expect, it } from "vitest";
import { ApiClient } from "./client";
import { installMockApi, listItemCards, listSummaries, mockDemoUser, mockEvents, mockFriendIds, resetMockLists, SHARED_COLLECTION_TITLE } from "./mock";

const DEMO_USER_ID = mockDemoUser.id;
const ANNA_ID = mockFriendIds[0];

function sharedSummary(userId: string) {
  const shared = listSummaries(userId, null).find((summary) => summary.list.preset === null);
  expect(shared).toBeDefined();
  return shared!;
}

describe("shared collection fixtures", () => {
  afterEach(resetMockLists);

  it("appear in the lists of both participants with the participant pair", () => {
    for (const userId of [DEMO_USER_ID, ANNA_ID]) {
      const shared = sharedSummary(userId);

      expect(shared.list.title).toBe(SHARED_COLLECTION_TITLE);
      expect(shared.participants.map((participant) => participant.id)).toEqual([DEMO_USER_ID, ANNA_ID]);
    }
  });

  it("seed items of both participants with their authors", () => {
    const shared = sharedSummary(DEMO_USER_ID);
    const cards = listItemCards(shared.list.id)!;

    expect(shared.itemsCount).toBe(2);
    expect(cards.map((card) => card.addedBy?.id)).toEqual([ANNA_ID, DEMO_USER_ID]);
  });
});

describe("shared collection endpoints", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockLists();
  });

  it("serve the list screen with participants and both participants' items", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");
    const shared = sharedSummary(DEMO_USER_ID);

    const screen = await client.getList(shared.list.id);

    expect(screen.list.id).toBe(shared.list.id);
    expect(screen.participants.map((participant) => participant.id)).toEqual([DEMO_USER_ID, ANNA_ID]);
    expect(screen.items).toHaveLength(2);
    expect(screen.items.map((item) => item.addedBy?.id)).toEqual([ANNA_ID, DEMO_USER_ID]);
    expect(screen.items.map((item) => item.event.id)).toEqual([mockEvents[7].id, mockEvents[6].id]);
  });

  it("let both participants add items to the collection", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");
    const shared = sharedSummary(DEMO_USER_ID);

    await client.addListItem(shared.list.id, { userId: ANNA_ID, eventId: mockEvents[8].id });

    const after = await client.getList(shared.list.id);
    expect(after.items).toHaveLength(3);
    expect(after.items[0].addedBy?.id).toBe(ANNA_ID);
    expect(after.items[0].event.id).toBe(mockEvents[8].id);
    const summaries = await client.listLists(ANNA_ID);
    expect(summaries.find((summary) => summary.list.id === shared.list.id)!.itemsCount).toBe(3);
  });

  it("keep preset lists personal and without authors", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");
    const preset = listSummaries(DEMO_USER_ID, null).find((summary) => summary.list.preset !== null)!;

    const screen = await client.getList(preset.list.id);

    expect(screen.participants).toEqual([]);
    expect(screen.items.every((item) => item.addedBy === null)).toBe(true);
  });

  it("return 404 for an unknown list", async () => {
    restore = installMockApi();

    await expect(new ApiClient("/api").getList("70000000-0000-4000-8000-000000000099")).rejects.toMatchObject({ name: "ApiError", status: 404 });
  });
});
