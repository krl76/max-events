import { afterEach, describe, expect, it } from "vitest";
import { AfterMeResponseSchema, TasteProfileSchema } from "@max-events/api-contracts";
import { ApiClient } from "./client";
import { afterMePicks, createMockCheckIn, installMockApi, mockDemoUser, mockEvents, resetMockCheckIns, resetMockProfiles, resetMockReviews, tasteProfile } from "./mock";

const now = new Date("2026-09-12T09:00:00Z");

describe("mock taste graph", () => {
  afterEach(resetMockCheckIns);

  it("is empty until the user has visited something", () => {
    const profile = tasteProfile(mockDemoUser.id, now);

    expect(TasteProfileSchema.safeParse(profile)).toMatchObject({ success: true });
    expect(profile.eventCategories).toEqual([]);
    // No graph, no suggestion — the «После меня» block has nothing to show and stays hidden.
    expect(afterMePicks(mockDemoUser.id, now).suggestions).toEqual([]);
  });

  it("weighs the categories the user actually checked into", () => {
    const sport = mockEvents.find((event) => event.category === "sport")!;
    createMockCheckIn(mockDemoUser.id, { eventId: sport.id });

    const profile = tasteProfile(mockDemoUser.id, now);

    expect(profile.eventCategories).toEqual([{ category: "sport", weight: 1 }]);
    // Somebody else's visits are not this user's taste.
    expect(tasteProfile("a0000000-0000-4000-8000-0000000000ff", now).eventCategories).toEqual([]);
  });

  it("suggests more of the strongest category, in the backend's wording", () => {
    const sport = mockEvents.find((event) => event.category === "sport")!;
    createMockCheckIn(mockDemoUser.id, { eventId: sport.id });

    const { suggestions } = afterMePicks(mockDemoUser.id, now);

    expect(AfterMeResponseSchema.safeParse({ suggestions })).toMatchObject({ success: true });
    expect(suggestions[0]).toMatchObject({ fromCategory: "sport", toCategory: "sport", afterCount: 1 });
    expect(suggestions[0]!.explanation).toBe("После 1 посещений категории «спорт» тебе зайдёт ещё что-то из этой ленты.");
    expect(suggestions[0]!.events.every((event) => event.category === "sport")).toBe(true);
    // Soonest first and nothing already past, the same window the backend queries.
    expect(suggestions[0]!.events.every((event) => new Date(event.startsAt).getTime() >= now.getTime())).toBe(true);
    expect(suggestions[0]!.events.map((event) => event.startsAt)).toEqual([...suggestions[0]!.events.map((event) => event.startsAt)].sort());
    expect(suggestions[0]!.events.length).toBeLessThanOrEqual(5);
  });

  it("counts a review into the graph, the way buildTasteGraph does", async () => {
    const restore = installMockApi();
    try {
      const afisha = mockEvents.find((event) => event.category === "afisha")!;
      await new ApiClient("/api").createReview({ userId: mockDemoUser.id, eventId: afisha.id, stars: 5, wouldGoAgain: true });

      // stars/5 plus half a point for «пойду ещё раз» — a review is taste even without a check-in.
      expect(tasteProfile(mockDemoUser.id, now).eventCategories).toEqual([{ category: "afisha", weight: 1.5 }]);
      expect(afterMePicks(mockDemoUser.id, now).suggestions[0]).toMatchObject({ fromCategory: "afisha", afterCount: 2 });
    } finally {
      restore();
      resetMockReviews();
    }
  });

  it("suggests the category the user actually moved on to", async () => {
    const sport = mockEvents.find((event) => event.category === "sport")!;
    const tourism = mockEvents.find((event) => event.category === "tourism")!;
    createMockCheckIn(mockDemoUser.id, { eventId: sport.id });
    createMockCheckIn(mockDemoUser.id, { eventId: tourism.id });
    createMockCheckIn(mockDemoUser.id, { eventId: mockEvents.find((event) => event.category === "sport" && event.id !== sport.id)!.id });

    const { transitions } = tasteProfile(mockDemoUser.id, now);
    const suggestion = afterMePicks(mockDemoUser.id, now).suggestions[0]!;

    expect(transitions).toContainEqual({ fromCategory: "sport", toCategory: "tourism", count: 1 });
    // Two sport visits beat one tourism visit, and the transition says what came after sport.
    expect(suggestion).toMatchObject({ fromCategory: "sport", toCategory: "tourism" });
    expect(suggestion.explanation).toBe("После 2 посещений категории «спорт» тебе зайдёт «туризм».");
  });

  it("offers nothing when the viewer's city has nothing upcoming", async () => {
    const restore = installMockApi();
    try {
      const sport = mockEvents.find((event) => event.category === "sport")!;
      createMockCheckIn(mockDemoUser.id, { eventId: sport.id });
      await new ApiClient("/api").updateProfile({ city: "Казань" });

      // The backend queries the profile city; a suggestion with no events must not reach the screen.
      expect(afterMePicks(mockDemoUser.id, now).suggestions[0]!.events).toEqual([]);
    } finally {
      restore();
      resetMockProfiles();
    }
  });

  it("serves both routes through the typed client", async () => {
    const restore = installMockApi();
    try {
      const client = new ApiClient("/api");
      expect((await client.getAfterMe()).suggestions).toEqual([]);

      createMockCheckIn(mockDemoUser.id, { eventId: mockEvents.find((event) => event.category === "tourism")!.id });

      expect(await client.getTaste()).toMatchObject({ userId: mockDemoUser.id, eventCategories: [{ category: "tourism", weight: 1 }] });
      expect((await client.getAfterMe()).suggestions[0]).toMatchObject({ fromCategory: "tourism" });
    } finally {
      restore();
    }
  });
});
