import { describe, expect, it } from "vitest";
import { WheretoResponseSchema, type WheretoQuery } from "@max-events/api-contracts";
import { ApiClient } from "./client";
import { MOCK_NOW, installMockApi, wheretoSuggestions } from "./mock";

const query = (over: Partial<WheretoQuery> = {}): WheretoQuery => ({ company: "alone", mood: "active", budget: "any", ...over });

describe("wheretoSuggestions", () => {
  it("passes the whereto contract and caps the result at 5 events sorted by start time", () => {
    const result = wheretoSuggestions(query());

    expect(WheretoResponseSchema.safeParse(result)).toMatchObject({ success: true });
    expect(result.items).toHaveLength(5);
    const keys = result.items.map((item) => `${item.startsAt} ${item.id}`);
    expect([...keys].sort((a, b) => a.localeCompare(b))).toEqual(keys);
  });

  it("keeps only upcoming events and maps mood to categories", () => {
    const active = wheretoSuggestions(query({ mood: "active" })).items;
    const calm = wheretoSuggestions(query({ mood: "calm" })).items;

    expect(active.length).toBeGreaterThan(0);
    expect(active.every((item) => new Date(item.startsAt).getTime() >= MOCK_NOW.getTime())).toBe(true);
    expect(active.every((item) => item.category === "sport" || item.category === "tourism")).toBe(true);
    expect(calm.every((item) => item.category === "afisha")).toBe(true);
    expect(calm.every((item) => new Date(item.startsAt).getTime() >= MOCK_NOW.getTime())).toBe(true);
  });

  it("budget free keeps only unpaid events, under_3000 keeps free and cheap ones", () => {
    const free = wheretoSuggestions(query({ mood: "unusual", budget: "free" })).items;
    const cheap = wheretoSuggestions(query({ mood: "unusual", budget: "under_3000" })).items;

    expect(free.length).toBeGreaterThan(0);
    expect(free.every((item) => !item.isPaid)).toBe(true);
    expect(cheap.every((item) => !item.isPaid || (item.priceRub !== null && item.priceRub <= 3000))).toBe(true);
  });

  it("company partner drops volunteering, kids caps the price", () => {
    const partner = wheretoSuggestions(query({ mood: "unusual", company: "partner" })).items;
    const kids = wheretoSuggestions(query({ mood: "unusual", company: "kids", budget: "any" })).items;

    expect(partner.every((item) => item.category !== "volunteering")).toBe(true);
    expect(kids.every((item) => (item.priceRub ?? 0) <= 3000)).toBe(true);
  });

  it("serves the suggestions through the typed client", async () => {
    const restore = installMockApi();
    try {
      expect(await new ApiClient("/api").getWhereto(query())).toEqual(wheretoSuggestions(query()));
    } finally {
      restore();
    }
  });

  it("rejects an invalid query with 400 (backend controller parity)", async () => {
    const restore = installMockApi();
    try {
      await expect(new ApiClient("/api").getWhereto(query({ mood: "party" as never }))).rejects.toMatchObject({ name: "ApiError", status: 400 });
    } finally {
      restore();
    }
  });
});
