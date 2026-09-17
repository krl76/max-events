// START_MODULE_CONTRACT
// PURPOSE: Organizer promocodes and early-access booking window.
// SCOPE: create/list codes; setBookingOpensAt; redeem inside a booking transaction; list bookings with applied code.
// DEPENDS: typeorm, @max-events/api-contracts, events/bookings
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - toPromoDto - entity to PromoCode
// - PromoService - CRUD, early access, redeem, booking list
// END_MODULE_MAP

import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, QueryFailedError, Repository } from "typeorm";
import type { CreatePromoCodeWrite, OrganizerBookingRow, PromoCode } from "@max-events/api-contracts";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import { PromoCodeEntity } from "./promo-code.entity";

@Injectable()
export class PromoService {
  constructor(
    @InjectRepository(PromoCodeEntity) private readonly codes: Repository<PromoCodeEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(BookingEntity) private readonly bookings: Repository<BookingEntity>,
  ) {}

  async create(actorId: string, eventId: string, payload: CreatePromoCodeWrite): Promise<PromoCode> {
    const event = await this.requireOwnedEvent(actorId, eventId);
    const code = payload.code.trim().toUpperCase();
    if (!code || code.length > 40) throw new BadRequestException("Invalid promo payload");
    try {
      const saved = await this.codes.save(
        this.codes.create({
          eventId: event.id,
          organizerUserId: actorId,
          code,
          maxRedemptions: payload.maxRedemptions ?? null,
          redeemedCount: 0,
          expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
        }),
      );
      return toPromoDto(saved);
    } catch (error) {
      if (error instanceof QueryFailedError && error.driverError?.code === "23505") throw new ConflictException("Promo code already exists");
      throw error;
    }
  }

  async list(actorId: string, eventId: string): Promise<PromoCode[]> {
    await this.requireOwnedEvent(actorId, eventId);
    const rows = await this.codes.find({ where: { eventId }, order: { createdAt: "ASC" } });
    return rows.map(toPromoDto);
  }

  async setEarlyAccess(actorId: string, eventId: string, bookingOpensAt: Date): Promise<{ bookingOpensAt: string }> {
    const event = await this.requireOwnedEvent(actorId, eventId);
    event.bookingOpensAt = bookingOpensAt;
    await this.events.save(event);
    return { bookingOpensAt: bookingOpensAt.toISOString() };
  }

  async listBookings(actorId: string, eventId: string): Promise<OrganizerBookingRow[]> {
    await this.requireOwnedEvent(actorId, eventId);
    const rows = await this.bookings.find({ where: { eventId }, order: { createdAt: "ASC" } });
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      eventId: row.eventId,
      status: row.status,
      promoCode: row.promoCode ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async redeemInTransaction(manager: EntityManager, event: EventEntity, rawCode: string | undefined, now: Date): Promise<string | null> {
    const opensAt = event.bookingOpensAt;
    const early = opensAt != null && now.getTime() < opensAt.getTime();
    const code = rawCode?.trim().toUpperCase();
    if (!early && !code) return null;
    if (!code) throw new ForbiddenException("Early access requires a promo code");
    const row = await manager.findOne(PromoCodeEntity, { where: { eventId: event.id, code }, lock: { mode: "pessimistic_write" } });
    if (!row) throw new ForbiddenException("Invalid promo code");
    if (row.expiresAt && row.expiresAt.getTime() <= now.getTime()) throw new ForbiddenException("Promo code expired");
    if (row.maxRedemptions !== null && row.redeemedCount >= row.maxRedemptions) throw new ForbiddenException("Promo code exhausted");
    row.redeemedCount += 1;
    await manager.save(PromoCodeEntity, row);
    return code;
  }

  private async requireOwnedEvent(actorId: string, eventId: string): Promise<EventEntity> {
    const event = await this.events.findOneBy({ id: eventId });
    if (!event) throw new NotFoundException("Event not found");
    if (event.organizerUserId !== actorId) throw new ForbiddenException("Not the organizer");
    return event;
  }
}

export function toPromoDto(row: PromoCodeEntity): PromoCode {
  return {
    id: row.id,
    eventId: row.eventId,
    code: row.code,
    maxRedemptions: row.maxRedemptions,
    redeemedCount: row.redeemedCount,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}
