// START_MODULE_CONTRACT
// PURPOSE: Personal calendar — active bookings of the current user split by event start into upcoming/past.
// SCOPE: list(userId, now) joins booking+event+optional place; cancelled bookings are omitted.
// DEPENDS: @nestjs/typeorm, typeorm, @max-events/api-contracts, bookings/events/places entities and DTO mappers
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CalendarService - list upcoming/past calendar entries
// END_MODULE_MAP

import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { Booking, CalendarEntry, CalendarResponse } from "@max-events/api-contracts";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import { toEventDto } from "../events/events.service";
import { PlaceEntity } from "../places/place.entity";
import { toPlaceDto } from "../places/places.service";

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(BookingEntity) private readonly bookings: Repository<BookingEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(PlaceEntity) private readonly places: Repository<PlaceEntity>,
  ) {}

  async list(userId: string, now = new Date()): Promise<CalendarResponse> {
    const bookings = await this.bookings.find({ where: { userId, status: "active" } });
    const entries: CalendarEntry[] = [];
    for (const booking of bookings) {
      const event = await this.events.findOneBy({ id: booking.eventId });
      if (!event) continue;
      const place = event.placeId ? await this.places.findOneBy({ id: event.placeId }) : null;
      entries.push({
        booking: toBooking(booking),
        event: toEventDto(event),
        place: place ? toPlaceDto(place) : null,
      });
    }
    const byStart = (a: CalendarEntry, b: CalendarEntry) => a.event.startsAt.localeCompare(b.event.startsAt);
    return {
      upcoming: entries.filter((entry) => new Date(entry.event.startsAt).getTime() >= now.getTime()).sort(byStart),
      past: entries.filter((entry) => new Date(entry.event.startsAt).getTime() < now.getTime()).sort((a, b) => -byStart(a, b)),
    };
  }
}

function toBooking(booking: BookingEntity): Booking {
  return {
    id: booking.id,
    userId: booking.userId,
    eventId: booking.eventId,
    status: booking.status,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  };
}
