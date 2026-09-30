import { describe, expect, it } from "vitest";
import { AddWeGroupPhotoWriteSchema, CreateWeGroupWriteSchema, WeGroupSchema, WeGroupScreenSchema, WeGroupSummarySchema } from "./we-group.js";

const ownerUserId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f";
const memberId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90";

describe("AddWeGroupPhotoWriteSchema", () => {
  it("accepts a same-origin upload path the mini-app stores after PUT /uploads", () => {
    expect(AddWeGroupPhotoWriteSchema.parse({ url: "/api/uploads/018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f" }).url).toContain("/api/uploads/");
    expect(AddWeGroupPhotoWriteSchema.parse({ url: "https://cdn.example.com/p.jpg" }).url).toContain("https://");
    expect(AddWeGroupPhotoWriteSchema.safeParse({ url: "javascript:alert(1)" }).success).toBe(false);
  });
});

describe("CreateWeGroupWriteSchema", () => {
  it("requires a title and defaults memberIds to empty", () => {
    expect(CreateWeGroupWriteSchema.parse({ title: "Поездка в Казань" })).toEqual({ title: "Поездка в Казань", memberIds: [] });
    expect(CreateWeGroupWriteSchema.parse({ title: "Поездка в Казань", memberIds: [memberId] }).memberIds).toEqual([memberId]);
    expect(CreateWeGroupWriteSchema.safeParse({ title: "" }).success).toBe(false);
    expect(CreateWeGroupWriteSchema.safeParse({ title: "   " }).success).toBe(false);
  });
});

describe("WeGroupSchema", () => {
  it("accepts an active group and an archived one", () => {
    const active = WeGroupSchema.parse({
      id: ownerUserId,
      ownerUserId,
      title: "Поездка в Казань",
      status: "active",
      createdAt: "2026-09-12T10:00:00+03:00",
      updatedAt: "2026-09-12T10:00:00+03:00",
      archivedAt: null,
    });
    expect(active.status).toBe("active");
    expect(active.chatLink).toBeNull();
    expect(WeGroupSchema.parse({ ...active, status: "archived", archivedAt: "2026-09-20T10:00:00+03:00" }).status).toBe("archived");
  });
});

describe("WeGroupScreenSchema", () => {
  it("defaults empty bookings, route, budget and photos", () => {
    const screen = WeGroupScreenSchema.parse({
      group: {
        id: ownerUserId,
        ownerUserId,
        title: "Поездка в Казань",
        status: "active",
        createdAt: "2026-09-12T10:00:00+03:00",
        updatedAt: "2026-09-12T10:00:00+03:00",
        archivedAt: null,
      },
      members: [],
      events: [],
      places: [],
    });
    expect(screen.bookings).toEqual([]);
    expect(screen.route).toBeNull();
    expect(screen.budget).toBeNull();
    expect(screen.photos).toEqual([]);
    expect(screen.photosTotal).toBe(0);
    expect(screen.goingByEvent).toEqual([]);
  });
});

describe("WeGroupSummarySchema", () => {
  it("accepts a list-row summary", () => {
    const summary = WeGroupSummarySchema.parse({
      group: {
        id: ownerUserId,
        ownerUserId,
        title: "Поездка в Казань",
        status: "active",
        createdAt: "2026-09-12T10:00:00+03:00",
        updatedAt: "2026-09-12T10:00:00+03:00",
        archivedAt: null,
      },
      membersCount: 5,
      upcomingEventsCount: 3,
      photosTotal: 62,
    });
    expect(summary.budgetTotalRub).toBeNull();
    expect(summary.nextEventTitle).toBeNull();
  });
});
