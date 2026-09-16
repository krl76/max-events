import { afterEach, describe, expect, it, vi } from "vitest";
import { EventSchema, FriendSchema, PlaceSchema, TodayResponseSchema } from "@max-events/api-contracts";
import type { Event, ParticipationStatus } from "@max-events/api-contracts";
import { ApiClient } from "./client";
import { calendarEntries, filterMockEvents, friendActivityByFriend, installMockApi, mockEvents, mockFriendIds, mockFriends, mockOrganizers, mockPlaces, participationStats, resetMockBookings, resetMockParticipations, resetMockProfiles, todayPicks } from "./mock";

const DEMO_USER_ID = "a0000000-0000-4000-8000-000000000001";

describe("mock fixtures", () => {
  it("every event fixture passes the event contract", () => {
    for (const fixture of mockEvents) {
      expect(EventSchema.safeParse(fixture)).toMatchObject({ success: true });
    }
  });

  it("every place fixture passes the place contract", () => {
    for (const fixture of mockPlaces) {
      expect(PlaceSchema.safeParse(fixture)).toMatchObject({ success: true });
    }
  });

  it("covers all four categories, paid and free events, the target city", () => {
    const categories = new Set(mockEvents.map((item) => item.category));
    expect([...categories].sort()).toEqual(["afisha", "sport", "tourism", "volunteering"]);
    expect(mockEvents.some((item) => item.isPaid && item.paymentUrl !== null)).toBe(true);
    expect(mockEvents.some((item) => !item.isPaid)).toBe(true);
    expect(mockEvents.length).toBeGreaterThanOrEqual(8);
    expect(mockPlaces.length).toBeGreaterThanOrEqual(3);
    expect(mockEvents.every((item) => item.city === "Москва")).toBe(true);
  });
});

describe("filterMockEvents", () => {
  it("keeps only the requested category", () => {
    const events = filterMockEvents(mockEvents, { category: "sport" });
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((item) => item.category === "sport")).toBe(true);
  });

  it("matches the city case-insensitively and drops other cities", () => {
    expect(filterMockEvents(mockEvents, { city: "москва" })).toHaveLength(mockEvents.length);
    expect(filterMockEvents(mockEvents, { city: "Сочи" })).toHaveLength(0);
  });

  it("keeps events starting on the filter day", () => {
    const day = mockEvents[0].startsAt.slice(0, 10);
    const events = filterMockEvents(mockEvents, { date: day });
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((item) => item.startsAt.startsWith(day))).toBe(true);
  });

  it("combines several filters", () => {
    const probe = mockEvents[1];
    const events = filterMockEvents(mockEvents, { category: probe.category, date: probe.startsAt.slice(0, 10), city: probe.city });
    expect(events.map((item) => item.id)).toContain(probe.id);
    expect(events.every((item) => item.category === probe.category && item.city === probe.city)).toBe(true);
  });

  it("returns everything without filters", () => {
    expect(filterMockEvents(mockEvents, {})).toHaveLength(mockEvents.length);
  });
});

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

describe("event details and booking flow", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockBookings();
  });

  const client = () => new ApiClient("/api");
  const placeTarget = (): Event & { capacity: number } => mockEvents.find((item) => item.placeId !== null && item.capacity !== null) as Event & { capacity: number };

  it("serves event details with place, organizer and free seats", async () => {
    restore = installMockApi();
    const target = placeTarget();
    const details = await client().getEventDetails(target.id, DEMO_USER_ID);

    expect(details.event.id).toBe(target.id);
    expect(details.place?.id).toBe(target.placeId);
    expect(details.place?.title).toBe(mockPlaces.find((item) => item.id === target.placeId)?.title);
    expect(details.organizer).toMatchObject({ id: mockOrganizers[0].id, firstName: mockOrganizers[0].firstName });
    expect(details.remainingSeats).toBe(target.capacity);
    expect(details.activeBookingId).toBeNull();
  });

  it("reports 404 for unknown event details", async () => {
    restore = installMockApi();
    await expect(client().getEventDetails("00000000-0000-4000-8000-000000000000", DEMO_USER_ID)).rejects.toMatchObject({ name: "ApiError", status: 404 });
  });

  it("creates a booking and decrements the free seat counter", async () => {
    restore = installMockApi();
    const target = placeTarget();
    const api = client();

    const booking = await api.createBooking({ userId: DEMO_USER_ID, eventId: target.id });
    expect(booking.status).toBe("active");

    const details = await api.getEventDetails(target.id, DEMO_USER_ID);
    expect(details.remainingSeats).toBe(target.capacity - 1);
    expect(details.activeBookingId).toBe(booking.id);
  });

  it("refuses to book when no seats remain", async () => {
    restore = installMockApi();
    const capacities = mockEvents.map((item) => item.capacity).filter((value): value is number => value !== null);
    const capacity = Math.min(...capacities);
    const target = mockEvents.find((item) => item.capacity === capacity)!;
    const api = client();

    for (let i = 0; i < capacity; i += 1) {
      await api.createBooking({ userId: `f0000000-0000-4000-8000-${String(i).padStart(12, "0")}`, eventId: target.id });
    }

    await expect(api.createBooking({ userId: DEMO_USER_ID, eventId: target.id })).rejects.toMatchObject({ name: "ApiError", status: 409 });
  });

  it("cancels a booking, restoring seats and the bookable state", async () => {
    restore = installMockApi();
    const target = placeTarget();
    const api = client();

    const booking = await api.createBooking({ userId: DEMO_USER_ID, eventId: target.id });
    const cancelled = await api.cancelBooking(booking.id);
    expect(cancelled.status).toBe("cancelled");

    const details = await api.getEventDetails(target.id, DEMO_USER_ID);
    expect(details.remainingSeats).toBe(target.capacity);
    expect(details.activeBookingId).toBeNull();
  });

  it("keeps re-booking the same user idempotent", async () => {
    restore = installMockApi();
    const target = placeTarget();
    const api = client();

    const first = await api.createBooking({ userId: DEMO_USER_ID, eventId: target.id });
    const second = await api.createBooking({ userId: DEMO_USER_ID, eventId: target.id });
    expect(second.id).toBe(first.id);

    const details = await api.getEventDetails(target.id, DEMO_USER_ID);
    expect(details.remainingSeats).toBe(target.capacity - 1);
  });
});

describe("participation mock endpoints", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockParticipations();
  });

  const client = () => new ApiClient("/api");
  const showcase = mockEvents[0];

  it("seeds status counters, friends count and empty own status from fixtures", async () => {
    restore = installMockApi();
    const stats = await client().getParticipationStats(showcase.id, DEMO_USER_ID);

    expect(stats.myStatus).toBeNull();
    expect(stats.friendsCount).toBe(7);
    expect(stats.counts.wants_to_go).toBe(2);
    expect(stats.counts.going).toBe(1);
    expect(stats.counts.looking_for_company).toBe(4);
    expect(stats.counts.looking_for_travel_buddy).toBe(0);
  });

  it("sets, changes and clears my status with counters following", async () => {
    restore = installMockApi();
    const api = client();

    await api.setParticipationStatus(showcase.id, DEMO_USER_ID, "looking_for_company");
    const afterSet = await api.getParticipationStats(showcase.id, DEMO_USER_ID);
    expect(afterSet.myStatus).toBe("looking_for_company");
    expect(afterSet.counts.looking_for_company).toBe(5);

    await api.setParticipationStatus(showcase.id, DEMO_USER_ID, "going");
    const afterChange = await api.getParticipationStats(showcase.id, DEMO_USER_ID);
    expect(afterChange.myStatus).toBe("going");
    expect(afterChange.counts.looking_for_company).toBe(4);
    expect(afterChange.counts.going).toBe(2);

    await api.deleteParticipation(showcase.id, DEMO_USER_ID);
    const afterClear = await api.getParticipationStats(showcase.id, DEMO_USER_ID);
    expect(afterClear.myStatus).toBeNull();
    expect(afterClear.counts.going).toBe(1);
    expect(afterClear.counts.looking_for_company).toBe(4);
  });

  it("keeps statuses per user and per event", async () => {
    restore = installMockApi();
    const api = client();
    const other = mockEvents[10];

    await api.setParticipationStatus(showcase.id, DEMO_USER_ID, "going");
    await api.setParticipationStatus(other.id, DEMO_USER_ID, "looking_for_travel_buddy");
    await api.setParticipationStatus(showcase.id, mockFriendIds[0], "probably_going");

    const showcaseStats = await api.getParticipationStats(showcase.id, DEMO_USER_ID);
    expect(showcaseStats.myStatus).toBe("going");
    expect(showcaseStats.counts.probably_going).toBe(1);

    const otherStats = await api.getParticipationStats(other.id, DEMO_USER_ID);
    expect(otherStats.myStatus).toBe("looking_for_travel_buddy");
    expect(otherStats.counts.going).toBe(0);
  });

  it("counts a friend's participation into the friends counter but not my own status", async () => {
    restore = installMockApi();
    const api = client();
    const friendless = mockEvents[10];

    const before = await api.getParticipationStats(friendless.id, DEMO_USER_ID);
    expect(before.friendsCount).toBe(0);

    await api.setParticipationStatus(friendless.id, mockFriendIds[2], "going");
    const withFriend = await api.getParticipationStats(friendless.id, DEMO_USER_ID);
    expect(withFriend.friendsCount).toBe(1);
    expect(withFriend.counts.going).toBe(1);

    await api.setParticipationStatus(friendless.id, DEMO_USER_ID, "going");
    const withMe = await api.getParticipationStats(friendless.id, DEMO_USER_ID);
    expect(withMe.friendsCount).toBe(1);
    expect(withMe.counts.going).toBe(2);
  });

  it("rejects an invalid status, unknown events and clearing a missing status", async () => {
    restore = installMockApi();
    const api = client();
    const unknown = "00000000-0000-4000-8000-000000000000";

    await expect(api.setParticipationStatus(showcase.id, DEMO_USER_ID, "maybe" as ParticipationStatus)).rejects.toMatchObject({ name: "ApiError", status: 400 });
    await expect(api.setParticipationStatus(unknown, DEMO_USER_ID, "going")).rejects.toMatchObject({ name: "ApiError", status: 404 });
    await expect(api.deleteParticipation(showcase.id, DEMO_USER_ID)).rejects.toMatchObject({ name: "ApiError", status: 404 });
    await expect(api.getParticipationStats(unknown, DEMO_USER_ID)).rejects.toMatchObject({ name: "ApiError", status: 404 });
  });

  it("matches the pure participationStats helper and resets to the seed", async () => {
    restore = installMockApi();
    const api = client();
    await api.setParticipationStatus(showcase.id, DEMO_USER_ID, "going");

    expect(await api.getParticipationStats(showcase.id, DEMO_USER_ID)).toEqual(participationStats(showcase.id, DEMO_USER_ID));

    resetMockParticipations();
    expect(participationStats(showcase.id, DEMO_USER_ID)).toEqual({ counts: { wants_to_go: 2, probably_going: 0, going: 1, looking_for_company: 4, looking_for_travel_buddy: 0, looking_for_after_event_company: 0 }, friendsCount: 7, myStatus: null });
  });
});

describe("profile mock endpoints", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockProfiles();
  });

  it("serves a default profile for an unknown user", async () => {
    restore = installMockApi();

    const profile = await new ApiClient("/api").getProfile(DEMO_USER_ID);

    expect(profile).toEqual({ userId: DEMO_USER_ID, city: "Москва", interests: [] });
  });

  it("applies a PATCH and persists it for the next GET", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");

    const updated = await api.updateProfile(DEMO_USER_ID, { city: "Казань", interests: ["бег", "джаз"] });
    expect(updated).toEqual({ userId: DEMO_USER_ID, city: "Казань", interests: ["бег", "джаз"] });

    const reread = await api.getProfile(DEMO_USER_ID);
    expect(reread).toEqual(updated);
  });

  it("keeps a partial patch without touching other users", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");

    const updated = await api.updateProfile(DEMO_USER_ID, { city: "Казань" });
    expect(updated.interests).toEqual([]);

    const other = await api.getProfile("a0000000-0000-4000-8000-000000000002");
    expect(other.city).toBe("Москва");
    expect(other.interests).toEqual([]);
  });

  it("rejects an invalid patch body", async () => {
    restore = installMockApi();

    await expect(new ApiClient("/api").updateProfile(DEMO_USER_ID, { city: "" })).rejects.toMatchObject({ name: "ApiError", status: 400 });
  });
});

describe("calendar mock endpoint", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockBookings();
  });

  it("lists active bookings with their event and place", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");
    const target = mockEvents.find((item) => item.placeId !== null)!;
    const booking = await api.createBooking({ userId: DEMO_USER_ID, eventId: target.id });

    const entries = await api.listCalendar(DEMO_USER_ID);

    expect(entries).toHaveLength(1);
    expect(entries[0].booking.id).toBe(booking.id);
    expect(entries[0].event.id).toBe(target.id);
    expect(entries[0].place?.id).toBe(target.placeId);
  });

  it("drops cancelled bookings from the calendar", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");
    const booking = await api.createBooking({ userId: DEMO_USER_ID, eventId: mockEvents[0].id });

    await api.cancelBooking(booking.id);

    expect(await api.listCalendar(DEMO_USER_ID)).toHaveLength(0);
  });

  it("keeps other users' bookings out of the list", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");
    await api.createBooking({ userId: "a0000000-0000-4000-8000-000000000002", eventId: mockEvents[0].id });

    expect(await api.listCalendar(DEMO_USER_ID)).toHaveLength(0);
  });

  it("matches the pure calendarEntries helper", async () => {
    restore = installMockApi();
    const api = new ApiClient("/api");
    const target = mockEvents.find((item) => item.placeId !== null)!;
    await api.createBooking({ userId: DEMO_USER_ID, eventId: target.id });

    expect(await api.listCalendar(DEMO_USER_ID)).toEqual(calendarEntries(DEMO_USER_ID));
  });
});

describe("friends feed mock endpoint", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
    resetMockParticipations();
  });

  it("every friend fixture passes the friend contract and mirrors mockFriendIds", () => {
    for (const friend of mockFriends) {
      expect(FriendSchema.safeParse(friend)).toMatchObject({ success: true });
    }
    expect(mockFriends.map((friend) => friend.id)).toEqual(mockFriendIds);
  });

  it("groups seeded participations by friend, soonest event first", () => {
    const groups = friendActivityByFriend();

    expect(groups).toHaveLength(mockFriends.length);
    expect(groups[0].friend.name).toBe("Анна Соколова");
    expect(groups[0].events[0].event.id).toBe(mockEvents[1].id);
    const soonest = groups.map((group) => group.events[0].event.startsAt);
    expect([...soonest].sort((a, b) => a.localeCompare(b))).toEqual(soonest);
  });

  it("renders the README showcase: Анна → выставка, Дима → матч, Катя → фестиваль", () => {
    const byName = new Map(friendActivityByFriend().map((group) => [group.friend.name, group]));

    expect(byName.get("Анна Соколова")!.events.some(({ event }) => event.id === mockEvents[1].id)).toBe(true);
    expect(byName.get("Дима Кузнецов")!.events.some(({ event }) => event.id === mockEvents[5].id)).toBe(true);
    expect(byName.get("Катя Орлова")!.events.some(({ event }) => event.id === mockEvents[11].id)).toBe(true);
  });

  it("serves the friends feed through the typed client", async () => {
    restore = installMockApi();

    const groups = await new ApiClient("/api").getFriendsActivity(DEMO_USER_ID);

    expect(groups).toEqual(friendActivityByFriend());
    expect(groups[0].events[0].participationStatus).toBe("going");
  });
});

describe("today mock endpoint", () => {
  it("todayPicks passes the today contract and mirrors the README digest numbers", () => {
    expect(TodayResponseSchema.safeParse(todayPicks())).toMatchObject({ success: true });
    expect(todayPicks().summary).toEqual({ nearbyCount: mockEvents.length, suitableCount: 3, withFriendsCount: 2 });
  });

  it("curated cards exercise all four label kinds and reference existing events", () => {
    const kinds = new Set(todayPicks().cards.flatMap((card) => card.labels.map((label) => label.kind)));
    expect([...kinds].sort()).toEqual(["distance", "free_entry", "friend_attending", "spots_left"]);
    expect(todayPicks().cards.every((card) => mockEvents.includes(card.event))).toBe(true);
  });

  it("serves the digest through the typed client", async () => {
    const restore = installMockApi();
    try {
      expect(await new ApiClient("/api").getToday()).toEqual(todayPicks());
    } finally {
      restore();
    }
  });
});
