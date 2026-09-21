// START_MODULE_CONTRACT
// PURPOSE: Event page aggregate — event + place + organizer + seats + viewer-scoped booking/check-in/participation + rating.
// SCOPE: GET /events/:id/details payload; unpublished/unknown events 404; viewer fields from CurrentUser id; remainingSeats = capacity - bookedCount (clamped at 0).
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, ../places/places.service, ../reviews/reviews.service, ../promotion/promotion.service, ./event.entity, ./event.mapper
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - EventDetailsService - get(eventId, viewerId) composition plus optional weather attach
// END_MODULE_MAP

import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { EventDetails, Place, User } from "@max-events/api-contracts";
import { BookingEntity } from "../bookings/booking.entity";
import { CheckInEntity } from "../checkins/check-in.entity";
import { ParticipationEntity } from "../participations/participation.entity";
import { PlacesService } from "../places/places.service";
import { PromotionService } from "../promotion/promotion.service";
import { ReviewsService } from "../reviews/reviews.service";
import { UserEntity } from "../users/user.entity";
import { toUserDto } from "../users/users.service";
import { EventEntity } from "./event.entity";
import { EventWeatherService } from "./event-weather.service";
import { toEventDto } from "./event.mapper";

@Injectable()
export class EventDetailsService {
  constructor(
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(BookingEntity) private readonly bookings: Repository<BookingEntity>,
    @InjectRepository(CheckInEntity) private readonly checkIns: Repository<CheckInEntity>,
    @InjectRepository(ParticipationEntity) private readonly participations: Repository<ParticipationEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @Inject(PlacesService) private readonly places: PlacesService,
    @Inject(ReviewsService) private readonly reviews: ReviewsService,
    @Inject(PromotionService) private readonly promotions: PromotionService,
    @Inject(EventWeatherService) private readonly eventWeather: EventWeatherService,
  ) {}

  async get(eventId: string, viewerId: string): Promise<EventDetails> {
    const event = await this.events.findOneBy({ id: eventId });
    if (!event || event.published === false) throw new NotFoundException("Event not found");
    const [place, organizer, activeBooking, checkIn, participation, rating, promoted] = await Promise.all([this.placeFor(event.placeId), this.organizerFor(event.organizerUserId), this.bookings.findOneBy({ userId: viewerId, eventId, status: "active" }), this.checkIns.findOneBy({ userId: viewerId, eventId }), this.participations.findOneBy({ userId: viewerId, eventId }), this.reviews.eventRating(eventId), this.promotions.promotedEventIds()]);
    const mapped = toEventDto(event, { promoted: promoted.has(event.id) });
    const [withWeather] = await this.eventWeather.attach([mapped]);
    return {
      event: withWeather ?? mapped,
      place,
      organizer,
      remainingSeats: event.capacity === null ? null : Math.max(0, event.capacity - event.bookedCount),
      activeBookingId: activeBooking?.id ?? null,
      checkInId: checkIn?.id ?? null,
      myParticipationStatus: participation?.status ?? null,
      rating,
    };
  }

  private async placeFor(placeId: string | null): Promise<Place | null> {
    if (!placeId) return null;
    try {
      return await this.places.getById(placeId);
    } catch (error) {
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  }

  private async organizerFor(organizerUserId: string | null): Promise<User | null> {
    if (!organizerUserId) return null;
    const user = await this.users.findOneBy({ id: organizerUserId });
    return user ? toUserDto(user) : null;
  }
}
