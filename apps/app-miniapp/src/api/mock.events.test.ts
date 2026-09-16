import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "./client";
import { installMockApi, mockEvents } from "./mock";

describe("installMockApi", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    vi.unstubAllGlobals();
  });

  it("serves the filtered list through the typed client", async () => {
    restore = installMockApi();
    const events = await new ApiClient("/api").listEvents({ category: "volunteering" });
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((item) => item.category === "volunteering")).toBe(true);
  });

  it("applies date and city params from the query string", async () => {
    restore = installMockApi();
    const day = mockEvents[0].startsAt.slice(0, 10);
    const events = await new ApiClient("/api").listEvents({ date: day, city: "Москва" });
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((item) => item.startsAt.startsWith(day))).toBe(true);
  });

  it("serves a single event by id and reports 404 for unknown ids", async () => {
    restore = installMockApi();
    const client = new ApiClient("/api");
    const single = await client.getEvent(mockEvents[0].id);
    expect(single.id).toBe(mockEvents[0].id);
    await expect(client.getEvent("00000000-0000-4000-8000-000000000000")).rejects.toMatchObject({ name: "ApiError", status: 404 });
  });

  it("falls back to the original fetch outside /api/events", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 599 })));
    restore = installMockApi();
    const response = await fetch("/api/places/whatever");
    expect(response.status).toBe(599);
  });
});
