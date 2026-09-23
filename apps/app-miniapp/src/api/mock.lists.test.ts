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

  it("seed lists of the demo user's own beside the presets, each with items of its own", () => {
    const own = listSummaries(DEMO_USER_ID, null).filter((summary) => summary.list.preset === null && summary.participants.length === 0);

    expect(own.map((summary) => summary.list.title)).toEqual(["Джаз по четвергам", "Летний список"]);
    expect(own.every((summary) => summary.itemsCount > 0)).toBe(true);
  });

  it("report no saved item for an event that is not in any list", () => {
    const summaries = listSummaries(DEMO_USER_ID, mockEvents[2].id);

    expect(summaries.every((summary) => summary.savedItemId === null)).toBe(true);
  });
});

describe("mock list management", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockLists();
  });

  it("creates a list of one's own next to the presets, renames it and deletes it with its items", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");

    const created = await client.createList("Сводить маму");
    expect(created).toMatchObject({ preset: null, title: "Сводить маму" });
    await client.addListItem(created.id, { userId: DEMO_USER_ID, eventId: mockEvents[0].id });

    expect((await client.listLists(DEMO_USER_ID)).map((row) => row.list.id)).toContain(created.id);
    expect((await client.renameList(created.id, "Сводить папу")).title).toBe("Сводить папу");

    const removed = await client.deleteList(created.id);
    expect(removed.id).toBe(created.id);
    expect((await client.listLists(DEMO_USER_ID)).map((row) => row.list.id)).not.toContain(created.id);
    // The items go with the list; the backend gets this from ON DELETE CASCADE.
    await expect(client.getList(created.id)).rejects.toMatchObject({ status: 404 });
  });

  it("refuses to rename or delete a preset, and refuses a blank title", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");
    const preset = (await client.listLists(DEMO_USER_ID)).find((row) => row.list.preset !== null)!;

    await expect(client.renameList(preset.list.id, "Моё")).rejects.toMatchObject({ status: 403 });
    await expect(client.deleteList(preset.list.id)).rejects.toMatchObject({ status: 403 });
    await expect(client.createList("   ")).rejects.toMatchObject({ status: 400 });
    expect((await client.listLists(DEMO_USER_ID)).find((row) => row.list.id === preset.list.id)!.list.title).toBe(preset.list.title);
  });

  // The shared collection exists only in the mock: the server knows lists, presets and items, and
  // nothing about sharing. Its PATCH/DELETE therefore look at the preset flag alone, and the mock has
  // to be no stricter, or экран 39 would show a rename the real backend would have allowed.
  it("renames and deletes the shared collection, because the server has no rule against it", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");
    const shared = (await client.listLists(DEMO_USER_ID)).find((row) => row.participants.length > 0)!;

    expect((await client.renameList(shared.list.id, "Наше лето")).title).toBe("Наше лето");
    await client.deleteList(shared.list.id);
    expect((await client.listLists(DEMO_USER_ID)).map((row) => row.list.id)).not.toContain(shared.list.id);
  });

  it("404s a list that is not there, and 400s an id that is not one", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");

    await expect(client.renameList("70000000-0000-4000-8000-0000000000ff", "Моё")).rejects.toMatchObject({ status: 404 });
    await expect(client.deleteList("70000000-0000-4000-8000-0000000000ff")).rejects.toMatchObject({ status: 404 });
    // ParseUUIDPipe answers 400 on the backend; the mock has to say the same thing.
    await expect(client.deleteList("not-a-uuid")).rejects.toMatchObject({ status: 400 });
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
