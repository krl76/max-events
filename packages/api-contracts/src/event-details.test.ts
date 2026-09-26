import { describe, expect, it } from "vitest";
import { EventBookingOfferSchema, EventCompanionsSchema, EventDetailsSchema } from "./event-details.js";

const eventId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f";
const organizerId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d90";
const organizationId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d93";
const bookingId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d91";
const checkInId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d92";

const emptyRating = {
  summary: { eventId, averageStars: 0, reviewsCount: 0 },
  categoryAverages: { atmosphere: null, organization: null, price: null, place: null },
};

const minimalDetails = {
  event: {
    id: eventId,
    title: "Джаз в парке",
    category: "afisha",
    city: "Москва",
    startsAt: "2026-09-12T19:00:00+03:00",
  },
  place: null,
  organizer: null,
  organization: null,
  remainingSeats: null,
  activeBookingId: null,
  checkInId: null,
  myParticipationStatus: null,
  rating: emptyRating,
};

describe("EventDetailsSchema", () => {
  it("parses a minimal aggregate with all nullables empty", () => {
    const parsed = EventDetailsSchema.parse(minimalDetails);
    expect(parsed.event.id).toBe(eventId);
    expect(parsed.place).toBeNull();
    expect(parsed.organizer).toBeNull();
    expect(parsed.organization).toBeNull();
    expect(parsed.remainingSeats).toBeNull();
    expect(parsed.activeBookingId).toBeNull();
    expect(parsed.checkInId).toBeNull();
    expect(parsed.myParticipationStatus).toBeNull();
    expect(parsed.rating.summary.reviewsCount).toBe(0);
  });

  it("parses a full aggregate with viewer-scoped fields set", () => {
    const parsed = EventDetailsSchema.parse({
      ...minimalDetails,
      organizer: {
        id: organizerId,
        maxUserId: "424242",
        firstName: "Организатор",
        createdAt: "2026-09-01T10:00:00+03:00",
        updatedAt: "2026-09-01T10:00:00+03:00",
      },
      organization: { id: organizationId, name: "Культурный центр", contacts: "@centre" },
      remainingSeats: 7,
      activeBookingId: bookingId,
      checkInId,
      myParticipationStatus: "going",
      rating: {
        summary: { eventId, averageStars: 4.5, reviewsCount: 2 },
        categoryAverages: { atmosphere: 5, organization: 4, price: null, place: null },
      },
    });
    expect(parsed.organizer?.id).toBe(organizerId);
    // The public aggregate carries the organization's name and contacts, never its credentials.
    expect(parsed.organization).toEqual({ id: organizationId, name: "Культурный центр", contacts: "@centre", activities: [] });
    expect(parsed.remainingSeats).toBe(7);
    expect(parsed.activeBookingId).toBe(bookingId);
    expect(parsed.checkInId).toBe(checkInId);
    expect(parsed.myParticipationStatus).toBe("going");
    expect(parsed.rating.summary.averageStars).toBe(4.5);
  });

  it("rejects a non-uuid activeBookingId", () => {
    expect(EventDetailsSchema.safeParse({ ...minimalDetails, activeBookingId: "booking-1" }).success).toBe(false);
  });

  it("rejects a negative remainingSeats", () => {
    expect(EventDetailsSchema.safeParse({ ...minimalDetails, remainingSeats: -1 }).success).toBe(false);
  });

  it("rejects an unknown participation status", () => {
    expect(EventDetailsSchema.safeParse({ ...minimalDetails, myParticipationStatus: "maybe" }).success).toBe(false);
  });

  it("rejects a payload without the rating summary", () => {
    const { rating: _rating, ...withoutRating } = minimalDetails;
    expect(EventDetailsSchema.safeParse(withoutRating).success).toBe(false);
  });
});

describe("EventCompanionsSchema", () => {
  it("accepts empty people and a missing gathering", () => {
    const parsed = EventCompanionsSchema.parse({
      counts: { going: 1, wants: 2, looking: 0 },
      myStatus: "going",
      companions: [],
      gathering: null,
    });
    expect(parsed.counts.wants).toBe(2);
    expect(parsed.gathering).toBeNull();
  });

  it("rejects a companion that invents a chat title type", () => {
    expect(
      EventCompanionsSchema.safeParse({
        counts: { going: 0, wants: 0, looking: 0 },
        myStatus: null,
        companions: [{ friend: { id: organizerId, name: "Анна" }, status: "going", chatTitle: 1, sharedPlansCount: 0, matchesCount: 0, interests: [], note: null }],
        gathering: null,
      }).success,
    ).toBe(false);
  });
});

describe("EventBookingOfferSchema", () => {
  it("accepts an empty friends list and a zero queue", () => {
    expect(EventBookingOfferSchema.parse({ waitlistAhead: 0, friendsWithTickets: [] }).waitlistAhead).toBe(0);
  });

  it("rejects a negative queue length", () => {
    expect(EventBookingOfferSchema.safeParse({ waitlistAhead: -1, friendsWithTickets: [] }).success).toBe(false);
  });
});
