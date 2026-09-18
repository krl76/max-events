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

import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, QueryFailedError } from "typeorm";
import type { BookingStatus, BookingWithSeats, Payment } from "@max-events/api-contracts";
import { EventEntity } from "../events/event.entity";
import { PaymentsService } from "../payments/payments.service";
import { PromoService } from "../promo/promo.service";
import { WaitlistService } from "../waitlist/waitlist.service";
import { BookingEntity } from "./booking.entity";

@Injectable()
export class BookingsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(WaitlistService) private readonly waitlist: WaitlistService,
    @Inject(PromoService) private readonly promo: PromoService,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
  ) {}

  async create(userId: string, eventId: string, promoCode?: string | null, now = new Date(), referralCode?: string | null): Promise<BookingWithSeats> {
    try {
      const result = await this.dataSource.transaction(async (manager) => {
        const event = await manager.findOne(EventEntity, { where: { id: eventId }, lock: { mode: "pessimistic_write" } });
        if (!event || event.published === false) throw new NotFoundException("Event not found");
        const applied = await this.promo.redeemInTransaction(manager, event, promoCode ?? undefined, now);

        const duplicate = await manager.findOne(BookingEntity, { where: { userId, eventId, status: "active" satisfies BookingStatus } });
        if (duplicate) throw new ConflictException("Booking already exists");

        if (event.capacity !== null && event.bookedCount >= event.capacity) {
          throw new ConflictException("No seats left");
        }
        if (event.isPaid && (event.priceRub == null || event.priceRub <= 0)) {
          throw new BadRequestException("Paid event requires a price");
        }

        const booking = await manager.save(BookingEntity, manager.create(BookingEntity, { userId, eventId, status: "active", promoCode: applied }));
        await this.promo.recordFulfillmentInTransaction(manager, event, userId, booking.id, referralCode ?? undefined, now);
        event.bookedCount += 1;
        await manager.save(EventEntity, event);
        return { dto: toBookingDto(booking, event), event, bookingId: booking.id };
      });
      const payment = await this.paymentFor(result.event, result.bookingId, true);
      return { ...result.dto, payment };
    } catch (error) {
      throw translateUniqueViolation(error);
    }
  }

  async ensurePayment(userId: string, bookingId: string): Promise<BookingWithSeats> {
    const loaded = await this.dataSource.transaction(async (manager) => {
      const booking = await manager.findOne(BookingEntity, { where: { id: bookingId } });
      if (!booking) throw new NotFoundException("Booking not found");
      if (booking.userId !== userId) throw new ForbiddenException("Cannot pay for another user's booking");
      if (booking.status !== "active") throw new ConflictException("Cannot pay a cancelled booking");
      const event = await manager.findOne(EventEntity, { where: { id: booking.eventId } });
      if (!event || event.published === false) throw new NotFoundException("Event not found");
      return { booking, event };
    });
    const payment = await this.paymentFor(loaded.event, loaded.booking.id, false);
    return { ...toBookingDto(loaded.booking, loaded.event), payment };
  }

  async cancel(userId: string, bookingId: string, options?: { organizerId?: string }): Promise<BookingWithSeats> {
    const gate = await this.dataSource.transaction(async (manager) => {
      const booking = await manager.findOne(BookingEntity, { where: { id: bookingId } });
      if (!booking) throw new NotFoundException("Booking not found");
      const event = await manager.findOne(EventEntity, { where: { id: booking.eventId } });
      if (!event) throw new NotFoundException("Event not found");
      const asOrganizer = Boolean(options?.organizerId && event.organizerUserId === options.organizerId);
      if (booking.userId !== userId && !asOrganizer) throw new ForbiddenException("Cannot cancel another user's booking");
      return { alreadyCancelled: booking.status === "cancelled" };
    });
    const payment = gate.alreadyCancelled ? null : await this.payments.refundForBooking(bookingId);
    const result = await this.dataSource.transaction(async (manager) => {
      const booking = await manager.findOne(BookingEntity, { where: { id: bookingId } });
      if (!booking) throw new NotFoundException("Booking not found");
      const event = await manager.findOne(EventEntity, { where: { id: booking.eventId }, lock: { mode: "pessimistic_write" } });
      if (!event) throw new NotFoundException("Event not found");
      const locked = await manager.findOne(BookingEntity, { where: { id: bookingId }, lock: { mode: "pessimistic_write" } });
      if (!locked) throw new NotFoundException("Booking not found");
      if (locked.status === "cancelled") return { dto: toBookingDto(locked, event), offered: null };

      locked.status = "cancelled";
      event.bookedCount = Math.max(0, event.bookedCount - 1);
      await this.promo.releaseInTransaction(manager, event, locked.promoCode);
      await this.promo.releaseFulfillmentInTransaction(manager, locked.id);
      const saved = await manager.save(BookingEntity, locked);
      await manager.save(EventEntity, event);
      const offered = await this.waitlist.onSeatFreed(manager, event);
      return { dto: toBookingDto(saved, event), offered };
    });
    if (result.offered) await this.waitlist.notifyOffer(result.offered);
    return { ...result.dto, payment };
  }

  private async paymentFor(event: EventEntity, bookingId: string, skipIfCancelled: boolean): Promise<Payment | null> {
    if (!event.isPaid) return null;
    if (event.priceRub == null || event.priceRub <= 0) throw new BadRequestException("Paid event requires a price");
    const live = await this.dataSource.transaction(async (manager) => manager.findOne(BookingEntity, { where: { id: bookingId } }));
    if (!live || live.status !== "active") {
      if (skipIfCancelled) return null;
      throw new ConflictException("Cannot pay a cancelled booking");
    }
    return this.payments.ensureForBooking(bookingId, event.priceRub, `Билет: ${event.title}`);
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
    payment: null,
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
  if (error instanceof ConflictException || error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof BadRequestException) {
    return error;
  }
  return error;
}
