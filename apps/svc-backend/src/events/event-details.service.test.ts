import { NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { Repository } from "typeorm";
import type { Place } from "@max-events/api-contracts";
import { BookingEntity } from "../bookings/booking.entity";
import { CheckInEntity } from "../checkins/check-in.entity";
import { OrganizationEntity } from "../organizations/organization.entity";
import type { OrganizationsService } from "../organizations/organizations.service";
import { ParticipationEntity } from "../participations/participation.entity";
import type { PlacesService } from "../places/places.service";
import type { PromotionService } from "../promotion/promotion.service";
import { ReviewEntity } from "../reviews/review.entity";
import { ReviewsService } from "../reviews/reviews.service";
import { UserEntity } from "../users/user.entity";
import { EventDetailsService } from "./event-details.service";
import { EventEntity } from "./event.entity";
import type { EventWeatherService } from "./event-weather.service";

const eventId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d8f";
const placeId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d70";
const organizerId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d71";
const viewerId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d72";
const otherUserId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d73";
const bookingId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d74";
const checkInId = "018f3c5a-9b2e-7d21-9f3a-1c4e5b6a7d75";

const now = new Date("2026-09-01T07:00:00Z");

function makeEvent(overrides: Partial<EventEntity> = {}): EventEntity {
  return {
    id: eventId,
    title: "Джаз в парке",
    description: "",
    category: "afisha",
    city: "Москва",
    placeId,
    organizerUserId: organizerId,
    startsAt: new Date("2026-09-12T19:00:00+03:00"),
    endsAt: null,
    isPaid: false,
    priceRub: null,
    paymentUrl: null,
    capacity: 10,
    bookedCount: 3,
    published: true,
    bookingOpensAt: null,
    chatLink: null,
    chatSyncPending: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createStoreRepo<T extends { id?: string }>(initial: T[] = []) {
  const store = [...initial];
  const matches = (row: T, where: Record<string, unknown>) => Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value);
  return {
    store,
    findOneBy: async (where: Record<string, unknown>) => store.find((row) => matches(row, where)) ?? null,
    find: async (opts?: { where?: Record<string, unknown> }) => {
      const where = opts?.where;
      return where ? store.filter((row) => matches(row, where)) : [...store];
    },
  };
}

const organizer: UserEntity = {
  id: organizerId,
  maxUserId: "424242",
  firstName: "Организатор",
  lastName: null,
  avatarUrl: null,
  username: null,
  friendsSyncedAt: null,
  bannedFromPublishing: false,
  createdAt: now,
  updatedAt: now,
};

function createService(
  opts: {
    event?: EventEntity | null;
    bookings?: BookingEntity[];
    checkIns?: CheckInEntity[];
    participations?: ParticipationEntity[];
    users?: UserEntity[];
    organization?: OrganizationEntity | null;
    reviews?: ReviewEntity[];
    place?: Place | null;
  } = {},
) {
  const events = createStoreRepo<EventEntity>(opts.event ? [opts.event] : []);
  const bookings = createStoreRepo<BookingEntity>(opts.bookings ?? []);
  const checkIns = createStoreRepo<CheckInEntity>(opts.checkIns ?? []);
  const participations = createStoreRepo<ParticipationEntity>(opts.participations ?? []);
  const users = createStoreRepo<UserEntity>(opts.users ?? []);
  const reviewRows = createStoreRepo<ReviewEntity>(opts.reviews ?? []);
  const places = {
    getById: async (id: string) => {
      if (opts.place && opts.place.id === id) return opts.place;
      throw new NotFoundException("Place not found");
    },
  } as unknown as PlacesService;
  const reviews = new ReviewsService(reviewRows as unknown as Repository<ReviewEntity>, bookings as unknown as Repository<BookingEntity>, events as unknown as Repository<EventEntity>);
  const promotions = { promotedEventIds: async () => new Set<string>() } as unknown as PromotionService;
  const weather = { attach: async (rows: { weather?: unknown }[]) => rows } as unknown as EventWeatherService;
  const organizations = { findByOrganizerUserId: async (organizerUserId: string) => (opts.organization?.organizerUserId === organizerUserId ? opts.organization : null) } as unknown as OrganizationsService;
  const service = new EventDetailsService(events as unknown as Repository<EventEntity>, bookings as unknown as Repository<BookingEntity>, checkIns as unknown as Repository<CheckInEntity>, participations as unknown as Repository<ParticipationEntity>, users as unknown as Repository<UserEntity>, places, reviews, promotions, weather, organizations);
  return { service };
}

describe("EventDetailsService.get", () => {
  it("assembles the full aggregate with rating summary from reviews", async () => {
    const { service } = createService({
      event: makeEvent(),
      users: [organizer],
      place: { id: placeId } as Place,
      bookings: [{ id: bookingId, userId: viewerId, eventId, status: "active" } as BookingEntity],
      checkIns: [{ id: checkInId, userId: viewerId, eventId, placeId: null, visitDate: null, checkedInAt: now }],
      participations: [{ id: "p1", userId: viewerId, eventId, status: "going" } as ParticipationEntity],
      reviews: [
        { id: "r1", userId: otherUserId, eventId, stars: 4, categoryScores: { atmosphere: 5 }, wouldGoAgain: true, photoUrls: [], text: null, createdAt: now },
        { id: "r2", userId: organizerId, eventId, stars: 2, categoryScores: { atmosphere: 3 }, wouldGoAgain: false, photoUrls: [], text: null, createdAt: now },
      ],
    });
    const details = await service.get(eventId, viewerId);
    expect(details.event.id).toBe(eventId);
    expect(details.event.promoted).toBe(false);
    expect(details.place?.id).toBe(placeId);
    expect(details.organizer?.id).toBe(organizerId);
    expect(details.organizer?.firstName).toBe("Организатор");
    expect(details.remainingSeats).toBe(7);
    expect(details.activeBookingId).toBe(bookingId);
    expect(details.checkInId).toBe(checkInId);
    expect(details.myParticipationStatus).toBe("going");
    expect(details.rating.summary).toEqual({ eventId, placeId: null, averageStars: 3, reviewsCount: 2 });
    expect(details.rating.categoryAverages.atmosphere).toBe(4);
  });

  it("hides other users' booking, check-in and participation from the viewer", async () => {
    const { service } = createService({
      event: makeEvent({ capacity: 5, bookedCount: 2 }),
      bookings: [{ id: "b-other", userId: otherUserId, eventId, status: "active" } as BookingEntity, { id: "b-cancelled", userId: viewerId, eventId, status: "cancelled" } as BookingEntity],
      checkIns: [{ id: "c-other", userId: otherUserId, eventId, placeId: null, visitDate: null, checkedInAt: now }],
      participations: [{ id: "p-other", userId: otherUserId, eventId, status: "going" } as ParticipationEntity],
    });
    const details = await service.get(eventId, viewerId);
    expect(details.activeBookingId).toBeNull();
    expect(details.checkInId).toBeNull();
    expect(details.myParticipationStatus).toBeNull();
    expect(details.remainingSeats).toBe(3);
  });

  it("carries the organization the organizer publishes for", async () => {
    const { service } = createService({
      event: makeEvent(),
      users: [organizer],
      organization: { id: "00000000-0000-4000-8000-0000000000c1", name: "Культурный центр", contacts: "@centre", organizerUserId: organizerId, passwordHash: "scrypt$never$leaves$the$backend$x" } as OrganizationEntity,
    });

    const details = await service.get(eventId, viewerId);

    expect(details.organization).toEqual({ id: "00000000-0000-4000-8000-0000000000c1", name: "Культурный центр", contacts: "@centre", activities: [] });
    // The hash has no way out of the backend, so the public page cannot carry it.
    expect(JSON.stringify(details)).not.toContain("scrypt$");
  });

  it("leaves the organization null when the organizer belongs to none", async () => {
    const { service } = createService({ event: makeEvent(), users: [organizer] });

    await expect(service.get(eventId, viewerId).then((details) => details.organization)).resolves.toBeNull();
  });

  it("returns nulls for an event without place, organizer and capacity", async () => {
    const { service } = createService({
      event: makeEvent({ placeId: null, organizerUserId: null, capacity: null, bookedCount: 0 }),
    });
    const details = await service.get(eventId, viewerId);
    expect(details.place).toBeNull();
    expect(details.organizer).toBeNull();
    expect(details.remainingSeats).toBeNull();
    expect(details.rating.summary.reviewsCount).toBe(0);
  });

  it("throws NotFound for an unpublished event", async () => {
    const { service } = createService({ event: makeEvent({ published: false }) });
    await expect(service.get(eventId, viewerId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws NotFound for an unknown event", async () => {
    const { service } = createService();
    await expect(service.get(eventId, viewerId)).rejects.toBeInstanceOf(NotFoundException);
  });
});
