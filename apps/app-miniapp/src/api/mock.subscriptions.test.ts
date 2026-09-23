import { afterEach, describe, expect, it } from "vitest";
import { SubscriptionSchema } from "@max-events/api-contracts";
import { ApiClient } from "./client";
import { installMockApi, mockOrganization, mockOrganizers, mockPlaces, resetMockSubscriptions } from "./mock";

let restore: (() => void) | null = null;

describe("mock subscriptions", () => {
  afterEach(() => {
    restore?.();
    restore = null;
    resetMockSubscriptions();
  });

  it("seeds the follows of the subscriptions screen: all three types, each with a readable title", async () => {
    restore = installMockApi();

    const seeded = await new ApiClient("/api").listSubscriptions();

    expect(seeded.every((row) => SubscriptionSchema.safeParse(row).success)).toBe(true);
    expect([...new Set(seeded.map((row) => row.type))].sort()).toEqual(["interest", "organizer", "place"]);
    expect(seeded.every((row) => row.title.trim() !== "")).toBe(true);
  });

  it("follows an organizer and a place, names them, and lists both", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");

    const organizer = await client.createSubscription({ type: "organizer", organizerUserId: mockOrganizers[0].id });
    const place = await client.createSubscription({ type: "place", placeId: mockPlaces[1].id });

    // The title is what the profile list shows; a uuid there would be unreadable.
    expect(organizer.title).toBe(mockOrganization.name);
    expect(place.title).toBe(mockPlaces[1].title);
    expect(SubscriptionSchema.safeParse(organizer).success).toBe(true);
    expect((await client.listSubscriptions()).map((row) => row.id)).toEqual(expect.arrayContaining([organizer.id, place.id]));
  });

  it("is idempotent per target, like the backend", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");
    const before = (await client.listSubscriptions()).length;

    const first = await client.createSubscription({ type: "interest", interest: "походы" });
    const again = await client.createSubscription({ type: "interest", interest: "ПОХОДЫ" });

    expect(again.id).toBe(first.id);
    expect(await client.listSubscriptions()).toHaveLength(before + 1);
  });

  it("unsubscribes once and then answers 404", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");
    const created = await client.createSubscription({ type: "place", placeId: mockPlaces[1].id });

    expect((await client.removeSubscription(created.id)).id).toBe(created.id);
    expect((await client.listSubscriptions()).map((row) => row.id)).not.toContain(created.id);
    await expect(client.removeSubscription(created.id)).rejects.toMatchObject({ status: 404 });
  });

  it("refuses a target that does not exist and a payload that is not a target", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");

    await expect(client.createSubscription({ type: "place", placeId: "b0000009-0000-4000-8000-000000000009" })).rejects.toMatchObject({ status: 404 });
    await expect(client.createSubscription({ type: "interest", interest: "" })).rejects.toMatchObject({ status: 400 });
  });
});
