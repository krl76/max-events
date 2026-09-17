// START_MODULE_CONTRACT
// PURPOSE: Transactional event bookings — capacity lock, duplicate-active rejection, cancel that frees a seat.
// SCOPE: Create/cancel inside a DB transaction with pessimistic write on the event row; bookedCount; freeSeats on the response.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, ../events/event.entity, ./booking.entity
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - BookingsService - create and cancel bookings against EventEntity.bookedCount
// - toBookingDto - map BookingEntity plus remaining seats to BookingWithSeats
// END_MODULE_MAP

import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, QueryFailedError } from "typeorm";
import type { BookingStatus, BookingWithSeats } from "@max-events/api-contracts";
import { EventEntity } from "../events/event.entity";
import { BookingEntity } from "./booking.entity";

@Injectable()
export class BookingsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async create(userId: string, eventId: string): Promise<BookingWithSeats> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const event = await manager.findOne(EventEntity, { where: { id: eventId }, lock: { mode: "pessimistic_write" } });
        if (!event) throw new NotFoundException("Event not found");

        const duplicate = await manager.findOne(BookingEntity, { where: { userId, eventId, status: "active" satisfies BookingStatus } });
        if (duplicate) throw new ConflictException("Booking already exists");

        if (event.capacity !== null && event.bookedCount >= event.capacity) {
          throw new ConflictException("No seats left");
        }

        const booking = await manager.save(BookingEntity, manager.create(BookingEntity, { userId, eventId, status: "active" }));
        event.bookedCount += 1;
        await manager.save(EventEntity, event);
        return toBookingDto(booking, event);
      });
    } catch (error) {
      throw translateUniqueViolation(error);
    }
  }

  async cancel(userId: string, bookingId: string): Promise<BookingWithSeats> {
    return this.dataSource.transaction(async (manager) => {
      const booking = await manager.findOne(BookingEntity, { where: { id: bookingId } });
      if (!booking) throw new NotFoundException("Booking not found");
      if (booking.userId !== userId) throw new ForbiddenException("Cannot cancel another user's booking");

      const event = await manager.findOne(EventEntity, { where: { id: booking.eventId }, lock: { mode: "pessimistic_write" } });
      if (!event) throw new NotFoundException("Event not found");

      const locked = await manager.findOne(BookingEntity, { where: { id: bookingId }, lock: { mode: "pessimistic_write" } });
      if (!locked) throw new NotFoundException("Booking not found");
      if (locked.status === "cancelled") return toBookingDto(locked, event);

      locked.status = "cancelled";
      event.bookedCount = Math.max(0, event.bookedCount - 1);
      const saved = await manager.save(BookingEntity, locked);
      await manager.save(EventEntity, event);
      return toBookingDto(saved, event);
    });
  }
}

export function toBookingDto(booking: BookingEntity, event: EventEntity): BookingWithSeats {
  return {
    id: booking.id,
    userId: booking.userId,
    eventId: booking.eventId,
    status: booking.status,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
    freeSeats: freeSeats(event),
    chatLink: event.chatLink,
  };
}

function freeSeats(event: EventEntity): number | null {
  if (event.capacity === null) return null;
  return Math.max(0, event.capacity - event.bookedCount);
}

function translateUniqueViolation(error: unknown): unknown {
  if (error instanceof QueryFailedError && error.driverError?.code === "23505") {
    return new ConflictException("Booking already exists");
  }
  if (error instanceof ConflictException || error instanceof NotFoundException || error instanceof ForbiddenException) {
    return error;
  }
  return error;
}
