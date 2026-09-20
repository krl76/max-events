// START_MODULE_CONTRACT
// PURPOSE: Personal calendar — active bookings of the current user split by event start into upcoming/past.
// SCOPE: list(userId, now) joins booking+event+optional place in three queries (IN batches, no per-booking lookups); cancelled bookings are omitted.
// DEPENDS: @nestjs/typeorm, typeorm, @max-events/api-contracts, bookings/events/places entities and DTO mappers
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CalendarService - list upcoming/past calendar entries
// END_MODULE_MAP

import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
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
    // Two IN batches instead of a lookup per booking: a calendar with N bookings used to cost
    // 1 + 2N queries.
    const eventIds = [...new Set(bookings.map((row) => row.eventId))];
    const events = eventIds.length === 0 ? [] : await this.events.find({ where: { id: In(eventIds) } });
    const eventById = new Map(events.map((row) => [row.id, row]));
    const placeIds = [...new Set(events.map((row) => row.placeId).filter((id): id is string => id !== null))];
    const places = placeIds.length === 0 ? [] : await this.places.find({ where: { id: In(placeIds) } });
    const placeById = new Map(places.map((row) => [row.id, row]));
    const entries: CalendarEntry[] = [];
    for (const booking of bookings) {
      const event = eventById.get(booking.eventId);
      if (!event) continue;
      const place = event.placeId ? (placeById.get(event.placeId) ?? null) : null;
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
