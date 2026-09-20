import { afterEach, describe, expect, it } from "vitest";
import { ListPresetSchema, ListItemSchema, ListSchema } from "@max-events/api-contracts";
import { ApiClient } from "./client";
import { installMockApi, LIST_PRESET_TITLES, listItemCards, listSummaries, mockEvents, resetMockLists } from "./mock";

const DEMO_USER_ID = "a0000000-0000-4000-8000-000000000001";

describe("preset list fixtures", () => {
  afterEach(resetMockLists);

  it("seed the six README presets with ru titles for a user on demand", () => {
    const summaries = listSummaries(DEMO_USER_ID, null);
    const presets = summaries.filter((summary) => summary.list.preset !== null);

    expect(presets.map((summary) => summary.list.preset)).toEqual(ListPresetSchema.options);
    expect(presets.map((summary) => summary.list.title)).toEqual(Object.values(LIST_PRESET_TITLES));
    expect(presets.every((summary) => ListSchema.safeParse(summary.list).success)).toBe(true);
    expect(presets.every((summary) => summary.participants.length === 0)).toBe(true);
  });

  it("preseed want_to_go and favorites with known events and valid items", () => {
    const summaries = listSummaries(DEMO_USER_ID, null);
    const byPreset = new Map(summaries.map((summary) => [summary.list.preset, summary]));

    expect(byPreset.get("want_to_go")!.itemsCount).toBe(1);
    expect(byPreset.get("favorites")!.itemsCount).toBe(1);
    expect(byPreset.get("weekend")!.itemsCount).toBe(0);
    const cards = listItemCards(byPreset.get("want_to_go")!.list.id)!;
    expect(cards).toHaveLength(1);
    expect(cards[0].event.id).toBe(mockEvents[0].id);
    expect(ListItemSchema.safeParse(cards[0].item).success).toBe(true);
  });

  it("report no saved item for an event that is not in any list", () => {
    const summaries = listSummaries(DEMO_USER_ID, mockEvents[2].id);

    expect(summaries.every((summary) => summary.savedItemId === null)).toBe(true);
  });
});

describe("lists mock endpoints", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockLists();
  });

  it("serve preset lists with counters through the typed client", async () => {
    restore = installMockApi();

    const summaries = await new ApiClient("/api").listLists(DEMO_USER_ID);
    const presets = summaries.filter((summary) => summary.list.preset !== null);

    expect(presets.map((summary) => summary.list.preset)).toEqual(ListPresetSchema.options);
    expect(presets.find((summary) => summary.list.preset === "want_to_go")!.itemsCount).toBe(1);
  });

  it("add an event to a list, mark it as saved and stay idempotent", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");
    const eventId = mockEvents[2].id;
    const list = (await client.listLists(DEMO_USER_ID)).find((summary) => summary.list.preset === "want_to_go")!;

    const item = await client.addListItem(list.list.id, { userId: DEMO_USER_ID, eventId });
    expect(ListItemSchema.safeParse(item).success).toBe(true);

    const after = (await client.listLists(DEMO_USER_ID, eventId)).find((summary) => summary.list.preset === "want_to_go")!;
    expect(after.itemsCount).toBe(2);
    expect(after.savedItemId).toBe(item.id);

    const again = await client.addListItem(list.list.id, { userId: DEMO_USER_ID, eventId });
    expect(again.id).toBe(item.id);
    expect((await client.listLists(DEMO_USER_ID, eventId)).find((summary) => summary.list.preset === "want_to_go")!.itemsCount).toBe(2);
  });

  it("mark the preseeded membership and remove an event from a list", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");
    const eventId = mockEvents[0].id;
    const list = (await client.listLists(DEMO_USER_ID, eventId)).find((summary) => summary.savedItemId !== null)!;
    expect(list.list.preset).toBe("want_to_go");

    const removed = await client.removeListItem(list.list.id, list.savedItemId!);

    expect(removed.id).toBe(list.savedItemId);
    const after = (await client.listLists(DEMO_USER_ID, eventId)).find((summary) => summary.list.preset === "want_to_go")!;
    expect(after.savedItemId).toBeNull();
    expect(after.itemsCount).toBe(0);
  });

  it("return 404 for unknown lists, unknown events and unknown items", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");
    const list = (await client.listLists(DEMO_USER_ID)).find((summary) => summary.list.preset === "favorites")!;

    await expect(client.addListItem("70000000-0000-4000-8000-000000000099", { userId: DEMO_USER_ID, eventId: mockEvents[0].id })).rejects.toMatchObject({ name: "ApiError", status: 404 });
    await expect(client.addListItem(list.list.id, { userId: DEMO_USER_ID, eventId: "00000000-0000-4000-8000-000000000000" })).rejects.toMatchObject({ name: "ApiError", status: 404 });
    await expect(client.addListItem(list.list.id, { userId: "", eventId: mockEvents[0].id })).rejects.toMatchObject({ name: "ApiError", status: 400 });
    await expect(client.removeListItem(list.list.id, "71000000-0000-4000-8000-000000000099")).rejects.toMatchObject({ name: "ApiError", status: 404 });
  });
});
