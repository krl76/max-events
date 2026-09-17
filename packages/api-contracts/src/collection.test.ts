import { describe, expect, it } from "vitest";
import { AddCollectionItemWriteSchema, CollectionSchema, CollectionSectionSchema } from "./collection.js";

describe("CollectionSectionSchema", () => {
  it("covers the three README collection sections", () => {
    expect(CollectionSectionSchema.options).toEqual(["want_to_go", "already_been", "weekend_ideas"]);
  });
});

describe("CollectionSchema", () => {
  it("defaults chatLink to null before sharing", () => {
    const parsed = CollectionSchema.parse({
      id: "018f3c5a-0000-7000-8000-0000000000c1",
      ownerUserId: "018f3c5a-0000-7000-8000-000000000001",
      title: "Саша + Кирилл",
      createdAt: "2026-09-12T10:00:00+03:00",
      updatedAt: "2026-09-12T10:00:00+03:00",
    });
    expect(parsed.chatLink).toBeNull();
  });
});

describe("AddCollectionItemWriteSchema", () => {
  it("requires an event and a section", () => {
    expect(AddCollectionItemWriteSchema.safeParse({ eventId: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90" }).success).toBe(false);
    expect(AddCollectionItemWriteSchema.parse({ eventId: "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90", section: "want_to_go" }).section).toBe("want_to_go");
  });
});
