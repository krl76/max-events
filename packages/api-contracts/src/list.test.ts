import { describe, expect, it } from "vitest";
import { AddListItemWriteSchema, ListItemCardSchema, ListPresetSchema, ListItemSchema, ListSchema, ListSummarySchema } from "./list.js";

const list = {
  id: "018f3c5a-0000-7000-8000-000000000030",
  userId: "018f3c5a-0000-7000-8000-000000000001",
  preset: "want_to_go",
  title: "Хочу сходить",
  createdAt: "2026-09-11T10:00:00+03:00",
  updatedAt: "2026-09-11T10:00:00+03:00",
} as const;

const item = {
  id: "018f3c5a-0000-7000-8000-000000000031",
  listId: list.id,
  eventId: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90",
  placeId: null,
  addedAt: "2026-09-11T11:00:00+03:00",
} as const;

describe("ListPresetSchema", () => {
  it("accepts the README presets", () => {
    const presets = ["want_to_go", "favorites", "weekend", "with_children", "with_friends", "try_later"];
    for (const preset of presets) {
      expect(ListPresetSchema.safeParse(preset).success).toBe(true);
    }
  });

  it("rejects an unknown preset", () => {
    expect(ListPresetSchema.safeParse("wishlist").success).toBe(false);
  });
});

describe("ListSchema", () => {
  it("accepts a README preset list: Хочу сходить, Избранное, На выходные, С детьми, С друзьями, Попробовать потом", () => {
    expect(ListSchema.parse(list)).toEqual(list);
  });

  it("accepts a custom list without a preset", () => {
    const custom = { ...list, preset: null, title: "Идеи на осень" };
    expect(ListSchema.parse(custom)).toEqual(custom);
  });

  it("round-trips through JSON", () => {
    const parsed = ListSchema.parse(list);
    expect(ListSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });
});

describe("ListItemSchema", () => {
  it("accepts an item with eventId and the time it was added", () => {
    expect(ListItemSchema.parse(item)).toEqual(item);
  });

  it("accepts an item with placeId instead of eventId", () => {
    const placeItem = { ...item, eventId: null, placeId: "018f3c5a-0000-7000-8000-000000000099" };
    expect(ListItemSchema.parse(placeItem)).toEqual(placeItem);
  });

  it("rejects an item without event or place", () => {
    expect(ListItemSchema.safeParse({ ...item, eventId: null }).success).toBe(false);
  });

  it("rejects an item with both event and place", () => {
    expect(ListItemSchema.safeParse({ ...item, placeId: "018f3c5a-0000-7000-8000-000000000099" }).success).toBe(false);
  });
});

describe("AddListItemWriteSchema", () => {
  it("requires an event id", () => {
    expect(AddListItemWriteSchema.parse({ eventId: item.eventId })).toEqual({ eventId: item.eventId });
    expect(AddListItemWriteSchema.safeParse({}).success).toBe(false);
  });
});

describe("ListSummarySchema", () => {
  it("accepts a preset summary with a saved item id", () => {
    const summary = { list, itemsCount: 1, savedItemId: item.id, participants: [] };
    expect(ListSummarySchema.parse(summary)).toEqual(summary);
  });
});

describe("ListItemCardSchema", () => {
  it("requires an event on the card", () => {
    const event = {
      id: item.eventId,
      title: "Джаз",
      description: "",
      category: "afisha" as const,
      city: "Москва",
      placeId: null,
      startsAt: "2026-09-20T18:00:00+03:00",
      endsAt: null,
      isPaid: false,
      priceRub: null,
      paymentUrl: null,
      capacity: null,
      chatLink: null,
    };
    expect(ListItemCardSchema.parse({ item, event, addedBy: null })).toMatchObject({ item, addedBy: null });
  });
});
