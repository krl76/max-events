// START_MODULE_CONTRACT
// PURPOSE: FIFO waitlist — join when full, offer the freed seat with a confirmation timer, expire and pass on.
// SCOPE: join, confirm, decline, getMe, expireOffers; every path that drops an offer releases its reserved seat; onSeatFreed is called inside the booking-cancel transaction; notifyOffer DMs the offer with the event and the confirmation window.
// DEPENDS: typeorm, @max-events/api-contracts, bookings/events/users, max-bot
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OFFER_TTL_MS - confirmation window
// - formatWaitlistOfferText - offer DM: which event and until when
// - WaitlistService - join/confirm/decline/getMe/expire/onSeatFreed/fillVacancies/inviteNext
// - toWaitlistDto - entity plus FIFO position
// END_MODULE_MAP

import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, In, LessThanOrEqual, QueryFailedError, Repository } from "typeorm";
import type { WaitlistEntry, WaitlistStatus } from "@max-events/api-contracts";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import { MaxBotClient } from "../max-bot/max-bot.client";
import { PaymentsService } from "../payments/payments.service";
import { PromoService } from "../promo/promo.service";
import { moscowTimeLabel } from "../time/moscow-date";
import { UserEntity } from "../users/user.entity";
import { WaitlistEntryEntity } from "./waitlist-entry.entity";

export const OFFER_TTL_MS = 15 * 60 * 1000;

/**
 * The offer expires on a timer, so the DM has to say which event freed a seat and by when. A bare ISO
 * timestamp told the person neither. The deadline is absolute on purpose: a "N minutes left" countdown
 * would be computed here and read later, so a slow batch or a delayed DM would make it a lie.
 */
export function formatWaitlistOfferText(eventTitle: string, offeredUntil: Date): string {
  return `Место освободилось: «${eventTitle}». Подтверди до ${moscowTimeLabel(offeredUntil)} МСК — иначе место уйдёт следующему в очереди.`;
}
const QUEUE_STATUSES: WaitlistStatus[] = ["waiting", "offered"];

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);
  private expiring = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(WaitlistEntryEntity) private readonly entries: Repository<WaitlistEntryEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @Inject(MaxBotClient) private readonly bot: MaxBotClient,
    @Inject(PromoService) private readonly promo: PromoService,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
  ) {}

  async queueCountsByEventIds(eventIds: string[]): Promise<Map<string, number>> {
    if (eventIds.length === 0) return new Map();
    const rows = await this.entries.find({ where: { eventId: In(eventIds), status: In(QUEUE_STATUSES) } });
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.eventId, (counts.get(row.eventId) ?? 0) + 1);
    return counts;
  }

  async join(userId: string, eventId: string, now = new Date(), referralCode?: string | null): Promise<WaitlistEntry> {
    return this.dataSource.transaction(async (manager) => {
      const event = await manager.findOne(EventEntity, { where: { id: eventId }, lock: { mode: "pessimistic_write" } });
      if (!event || event.published === false) throw new NotFoundException("Event not found");
      if (publicBookingClosed(event, now)) throw new ForbiddenException("Waitlist opens when public booking starts");
      if (event.capacity === null || event.bookedCount < event.capacity) {
        throw new ConflictException("Seats are still available");
      }
      const duplicate = await manager.findOne(WaitlistEntryEntity, { where: { userId, eventId, status: In(QUEUE_STATUSES) } });
      if (duplicate) throw new ConflictException("Already on the waitlist");
      const activeBooking = await manager.findOne(BookingEntity, { where: { userId, eventId, status: "active" } });
      if (activeBooking) throw new ConflictException("Already booked");
      const normalizedCode = referralCode?.trim().toUpperCase() || null;
      if (normalizedCode && !(await this.promo.campaignExistsInTransaction(manager, eventId, normalizedCode))) {
        throw new BadRequestException("Invalid referral code");
      }
      const saved = await manager.save(WaitlistEntryEntity, manager.create(WaitlistEntryEntity, { userId, eventId, status: "waiting", offeredUntil: null, referralCode: normalizedCode }));
      return toWaitlistDto(saved, await positionOf(manager, saved));
    });
  }

  async confirm(userId: string, entryId: string, now = new Date()): Promise<WaitlistEntry> {
    const result = await this.dataSource.transaction(async (manager) => {
      const peek = await manager.findOne(WaitlistEntryEntity, { where: { id: entryId } });
      if (!peek) throw new NotFoundException("Waitlist entry not found");
      const event = await manager.findOne(EventEntity, { where: { id: peek.eventId }, lock: { mode: "pessimistic_write" } });
      if (!event || event.published === false) throw new NotFoundException("Event not found");
      if (publicBookingClosed(event, now)) throw new ForbiddenException("Waitlist opens when public booking starts");
      const entry = await manager.findOne(WaitlistEntryEntity, { where: { id: entryId }, lock: { mode: "pessimistic_write" } });
      if (!entry) throw new NotFoundException("Waitlist entry not found");
      if (entry.userId !== userId) throw new ForbiddenException("Cannot confirm another user's offer");
      if (entry.status === "confirmed") return { kind: "ok" as const, dto: toWaitlistDto(entry, await positionOf(manager, entry)) };
      if (entry.status === "expired" || !entry.offeredUntil || entry.offeredUntil.getTime() <= now.getTime()) {
        throw new ConflictException("Offer expired");
      }
      if (entry.status !== "offered") throw new ConflictException("Offer is not active");
      if (event.isPaid && (event.priceRub == null || event.priceRub <= 0)) throw new BadRequestException("Paid event requires a price");
      const position = await positionOf(manager, entry);
      let bookingId: string | undefined;
      try {
        const booking = await manager.save(BookingEntity, manager.create(BookingEntity, { userId, eventId: entry.eventId, status: "active" }));
        bookingId = booking.id;
        try {
          await this.promo.recordFulfillmentInTransaction(manager, event, userId, booking.id, entry.referralCode ?? undefined, now);
        } catch (error) {
          if (!(error instanceof ForbiddenException)) throw error;
        }
      } catch (error) {
        if (error instanceof QueryFailedError && error.driverError?.code === "23505") {
          entry.status = "expired";
          entry.offeredUntil = null;
          await manager.save(WaitlistEntryEntity, entry);
          const next = await this.onSeatFreed(manager, event, now, false);
          // The offer held a reserved seat. Handing it to the next entry keeps the count; with an
          // empty queue it has to go back on sale, exactly as decline and expiry release it.
          if (!next) {
            event.bookedCount = Math.max(0, event.bookedCount - 1);
            await manager.save(EventEntity, event);
          }
          return { kind: "duplicate" as const, next };
        }
        throw error;
      }
      entry.status = "confirmed";
      entry.offeredUntil = null;
      const saved = await manager.save(WaitlistEntryEntity, entry);
      return { kind: "ok" as const, dto: toWaitlistDto(saved, position), bookingId, event };
    });
    if (result.kind === "duplicate") {
      if (result.next) await this.notifyOffer(result.next);
      throw new ConflictException("Booking already exists");
    }
    if (result.bookingId && result.event.isPaid && result.event.priceRub && result.event.priceRub > 0) {
      await this.payments.ensureForBooking(result.bookingId, result.event.priceRub, `Билет: ${result.event.title}`);
    }
    return result.dto;
  }

  async decline(userId: string, entryId: string, now = new Date()): Promise<WaitlistEntry> {
    const result = await this.dataSource.transaction(async (manager) => {
      const peek = await manager.findOne(WaitlistEntryEntity, { where: { id: entryId } });
      if (!peek) throw new NotFoundException("Waitlist entry not found");
      const event = await manager.findOne(EventEntity, { where: { id: peek.eventId }, lock: { mode: "pessimistic_write" } });
      if (!event || event.published === false) throw new NotFoundException("Event not found");
      const entry = await manager.findOne(WaitlistEntryEntity, { where: { id: entryId }, lock: { mode: "pessimistic_write" } });
      if (!entry || entry.userId !== userId) throw new NotFoundException("Waitlist entry not found");
      if (entry.status === "cancelled") return { dto: toWaitlistDto(entry, await positionOf(manager, entry)), next: null };
      if (entry.status === "confirmed") throw new ConflictException("Cancel the booking instead");
      if (entry.status === "expired") throw new ConflictException("Offer expired");
      const wasOffered = entry.status === "offered";
      entry.status = "cancelled";
      entry.offeredUntil = null;
      const saved = await manager.save(WaitlistEntryEntity, entry);
      const dto = toWaitlistDto(saved, await positionOf(manager, saved));
      if (!wasOffered) return { dto, next: null };
      const next = await this.onSeatFreed(manager, event, now, false);
      if (!next) {
        event.bookedCount = Math.max(0, event.bookedCount - 1);
        await manager.save(EventEntity, event);
      }
      return { dto, next };
    });
    if (result.next) await this.notifyOffer(result.next);
    return result.dto;
  }

  async getMe(userId: string, eventId: string): Promise<WaitlistEntry> {
    return this.dataSource.transaction(async (manager) => {
      const entry = await manager.findOne(WaitlistEntryEntity, { where: { userId, eventId, status: In(QUEUE_STATUSES) } });
      if (!entry) throw new NotFoundException("Waitlist entry not found");
      return toWaitlistDto(entry, await positionOf(manager, entry));
    });
  }

  async onSeatFreed(manager: EntityManager, event: EventEntity, now = new Date(), reserveSeat = true): Promise<WaitlistEntryEntity | null> {
    if (publicBookingClosed(event, now)) return null;
    while (true) {
      const next = await manager.findOne(WaitlistEntryEntity, {
        where: { eventId: event.id, status: "waiting" },
        order: { createdAt: "ASC" },
        lock: { mode: "pessimistic_write" },
      });
      if (!next) return null;
      const active = await manager.findOne(BookingEntity, { where: { userId: next.userId, eventId: event.id, status: "active" } });
      if (active) {
        next.status = "cancelled";
        await manager.save(WaitlistEntryEntity, next);
        continue;
      }
      next.status = "offered";
      next.offeredUntil = new Date(now.getTime() + OFFER_TTL_MS);
      if (reserveSeat) {
        event.bookedCount += 1;
        await manager.save(EventEntity, event);
      }
      return manager.save(WaitlistEntryEntity, next);
    }
  }

  async inviteNext(eventId: string, count: number, now = new Date()): Promise<number> {
    const offered: WaitlistEntryEntity[] = [];
    await this.dataSource.transaction(async (manager) => {
      const event = await manager.findOne(EventEntity, { where: { id: eventId }, lock: { mode: "pessimistic_write" } });
      if (!event || event.published === false || event.capacity === null) return;
      for (let i = 0; i < count && event.bookedCount < event.capacity; i += 1) {
        const next = await this.onSeatFreed(manager, event, now, true);
        if (!next) break;
        offered.push(next);
      }
    });
    for (const entry of offered) await this.notifyOffer(entry);
    return offered.length;
  }

  async fillVacancies(eventId: string, now = new Date()): Promise<void> {
    const offered: WaitlistEntryEntity[] = [];
    await this.dataSource.transaction(async (manager) => {
      const event = await manager.findOne(EventEntity, { where: { id: eventId }, lock: { mode: "pessimistic_write" } });
      if (!event || event.published === false || event.capacity === null) return;
      while (event.bookedCount < event.capacity) {
        const next = await this.onSeatFreed(manager, event, now, true);
        if (!next) break;
        offered.push(next);
      }
    });
    for (const entry of offered) await this.notifyOffer(entry);
  }

  async expireOffers(now = new Date()): Promise<number> {
    // In-memory single-process lock. A second instance can tick in parallel; the event row-lock is the real mutex.
    if (this.expiring) return 0;
    this.expiring = true;
    try {
      const due = await this.entries.find({ where: { status: "offered", offeredUntil: LessThanOrEqual(now) } });
      let expired = 0;
      for (const entry of due) {
        const offered = await this.dataSource.transaction(async (manager) => {
          const event = await manager.findOne(EventEntity, { where: { id: entry.eventId }, lock: { mode: "pessimistic_write" } });
          if (!event) return null;
          const locked = await manager.findOne(WaitlistEntryEntity, { where: { id: entry.id }, lock: { mode: "pessimistic_write" } });
          if (!locked || locked.status !== "offered") return null;
          locked.status = "expired";
          locked.offeredUntil = null;
          await manager.save(WaitlistEntryEntity, locked);
          const next = await this.onSeatFreed(manager, event, now, false);
          if (!next) {
            event.bookedCount = Math.max(0, event.bookedCount - 1);
            await manager.save(EventEntity, event);
          }
          expired += 1;
          return next;
        });
        try {
          if (offered) await this.notifyOffer(offered);
        } catch {
          // A DM failure must not freeze remaining expiries until the next tick.
        }
      }
      const waiting = await this.entries.find({ where: { status: "waiting" } });
      const eventIds = [...new Set(waiting.map((row) => row.eventId))];
      for (const eventId of eventIds) await this.fillVacancies(eventId, now);
      return expired;
    } finally {
      this.expiring = false;
    }
  }

  async notifyOffer(entry: WaitlistEntryEntity): Promise<void> {
    const user = await this.users.findOneBy({ id: entry.userId });
    if (!user || !entry.offeredUntil) return;
    const event = await this.events.findOneBy({ id: entry.eventId });
    if (!event) {
      // The seat stays reserved for the full window either way, so a silent skip would hide it.
      this.logger.warn(`Waitlist offer ${entry.id} has no event ${entry.eventId}: no DM sent`);
      return;
    }
    await this.bot.sendMessage(user.maxUserId, formatWaitlistOfferText(event.title, entry.offeredUntil));
  }
}

export function toWaitlistDto(row: WaitlistEntryEntity, position: number): WaitlistEntry {
  return {
    id: row.id,
    userId: row.userId,
    eventId: row.eventId,
    position,
    status: row.status,
    offeredUntil: row.offeredUntil ? row.offeredUntil.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function publicBookingClosed(event: EventEntity, now: Date): boolean {
  return event.bookingOpensAt != null && now.getTime() < event.bookingOpensAt.getTime();
}

async function positionOf(manager: EntityManager, row: WaitlistEntryEntity): Promise<number> {
  const queue = await manager.find(WaitlistEntryEntity, { where: { eventId: row.eventId, status: In(["waiting", "offered"] satisfies WaitlistStatus[]) }, order: { createdAt: "ASC" } });
  const index = queue.findIndex((item) => item.id === row.id);
  return index < 0 ? queue.length + 1 : index + 1;
}
