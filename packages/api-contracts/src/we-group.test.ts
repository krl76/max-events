import { describe, expect, it } from "vitest";
import { CreateWeGroupWriteSchema, WeGroupSchema, WeGroupScreenSchema } from "./we-group.js";

const ownerUserId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f";
const memberId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90";

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
  });
});
