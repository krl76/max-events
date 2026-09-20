import { afterEach, describe, expect, it } from "vitest";
import { ApiClient } from "./client";
import { createMockReport, eventRating, feedPosts, installMockApi, mockEvents, mockPlaces, resetMockReports, resetMockReviews } from "./mock";

const DEMO_USER_ID = "a0000000-0000-4000-8000-000000000001";
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

describe("mock reviews and rating aggregate", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockReviews();
  });

  it("computes the seeded aggregate with per-category averages", () => {
    const rating = eventRating(mockEvents[0].id)!;

    expect(rating.summary).toMatchObject({ eventId: mockEvents[0].id, reviewsCount: 3, averageStars: 14 / 3 });
    expect(rating.categoryAverages.atmosphere).toBeCloseTo(14 / 3);
    expect(rating.categoryAverages.organization).toBeCloseTo(14 / 3);
    expect(rating.categoryAverages.price).toBeCloseTo(7 / 2);
    expect(rating.categoryAverages.place).toBe(4.5);
  });

  it("returns an empty aggregate for an event without reviews and 404 for an unknown one", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");
    const unrated = mockEvents[5];

    const rating = await api.getEventRating(unrated.id);
    expect(rating.summary).toEqual({ eventId: unrated.id, placeId: null, averageStars: 0, reviewsCount: 0 });
    expect(rating.categoryAverages).toEqual({ atmosphere: null, organization: null, price: null, place: null });

    await expect(api.getEventRating(UNKNOWN_ID)).rejects.toMatchObject({ name: "ApiError", status: 404 });
  });

  it("sends a review to the mock API and shows it in the aggregate", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");
    const target = mockEvents[5];

    const review = await api.createReview({ userId: DEMO_USER_ID, eventId: target.id, stars: 4, categoryScores: { atmosphere: 5 }, wouldGoAgain: true });
    expect(review).toMatchObject({ userId: DEMO_USER_ID, eventId: target.id, stars: 4, wouldGoAgain: true });

    const rating = await api.getEventRating(target.id);
    expect(rating.summary.reviewsCount).toBe(1);
    expect(rating.summary.averageStars).toBe(4);
    expect(rating.categoryAverages.atmosphere).toBe(5);
    expect(rating.categoryAverages.organization).toBeNull();
  });

  it("replaces the previous review of the same user instead of stacking", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");
    const target = mockEvents[5];

    await api.createReview({ userId: DEMO_USER_ID, eventId: target.id, stars: 2, wouldGoAgain: false });
    await api.createReview({ userId: DEMO_USER_ID, eventId: target.id, stars: 5, wouldGoAgain: true });

    const rating = await api.getEventRating(target.id);
    expect(rating.summary.reviewsCount).toBe(1);
    expect(rating.summary.averageStars).toBe(5);
  });

  it("rejects an out-of-range review with 400 and an unknown event with 404", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");

    await expect(api.createReview({ userId: DEMO_USER_ID, eventId: mockEvents[0].id, stars: 9, wouldGoAgain: true })).rejects.toMatchObject({ status: 400 });
    await expect(api.createReview({ userId: DEMO_USER_ID, eventId: UNKNOWN_ID, stars: 4, wouldGoAgain: true })).rejects.toMatchObject({ status: 404 });
  });
});

describe("mock reports", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockReports();
  });

  it("sends a report and answers 409 for a repeat report of the same user and event", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");
    const target = mockEvents[0];

    const report = await api.createReport({ userId: DEMO_USER_ID, eventId: target.id, reason: "spam" });
    expect(report).toMatchObject({ userId: DEMO_USER_ID, targetType: "event", targetId: target.id, reason: "spam", status: "open" });

    await expect(api.createReport({ userId: DEMO_USER_ID, eventId: target.id, reason: "abuse" })).rejects.toMatchObject({ name: "ApiError", status: 409 });
  });

  it("keeps reports of different users independent", () => {
    expect(createMockReport({ userId: "a0000000-0000-4000-8000-000000000002", eventId: mockEvents[0].id, reason: "spam" })).toMatchObject({ reason: "spam" });
    expect(createMockReport({ userId: DEMO_USER_ID, eventId: mockEvents[0].id, reason: "abuse" })).toMatchObject({ reason: "abuse" });
  });

  it("rejects an unknown event with 404 and an unknown reason with 400", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");

    await expect(api.createReport({ userId: DEMO_USER_ID, eventId: UNKNOWN_ID, reason: "spam" })).rejects.toMatchObject({ status: 404 });
    await expect(api.createReport({ userId: DEMO_USER_ID, eventId: mockEvents[0].id, reason: "nonsense" as "spam" })).rejects.toMatchObject({ status: 400 });
  });
});

describe("mock reports for places and feed posts", () => {
  afterEach(() => {
    resetMockReports();
  });

  it("creates a report for a place target", () => {
    const report = createMockReport({ userId: DEMO_USER_ID, placeId: mockPlaces[0].id, reason: "spam" });
    expect(report).toMatchObject({ userId: DEMO_USER_ID, targetType: "place", targetId: mockPlaces[0].id, reason: "spam" });
  });

  it("creates a report for a feed post target", () => {
    const feedPostId = feedPosts(null)[0].id;
    const report = createMockReport({ userId: DEMO_USER_ID, feedPostId, reason: "inaccurate" });
    expect(report).toMatchObject({ userId: DEMO_USER_ID, targetType: "feed_post", targetId: feedPostId, reason: "inaccurate" });
  });

  it("returns duplicate for a repeated report of the same target", () => {
    createMockReport({ userId: DEMO_USER_ID, placeId: mockPlaces[1].id, reason: "spam" });
    expect(createMockReport({ userId: DEMO_USER_ID, placeId: mockPlaces[1].id, reason: "abuse" })).toBe("duplicate");
  });

  it("returns no_target for an unknown place or feed post", () => {
    expect(createMockReport({ userId: DEMO_USER_ID, placeId: UNKNOWN_ID, reason: "spam" })).toBe("no_target");
    expect(createMockReport({ userId: DEMO_USER_ID, feedPostId: UNKNOWN_ID, reason: "spam" })).toBe("no_target");
  });

  it("returns invalid when zero or more than one target is given", () => {
    expect(createMockReport({ userId: DEMO_USER_ID, reason: "spam" as const })).toBe("invalid");
    expect(createMockReport({ userId: DEMO_USER_ID, eventId: mockEvents[0].id, placeId: mockPlaces[0].id, reason: "spam" })).toBe("invalid");
  });
});
