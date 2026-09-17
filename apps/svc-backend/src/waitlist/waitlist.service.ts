// START_MODULE_CONTRACT
// PURPOSE: FIFO waitlist — join when full, offer the freed seat with a confirmation timer, expire and pass on.
// SCOPE: join, confirm, expireOffers; onSeatFreed is called inside the booking-cancel transaction.
// DEPENDS: typeorm, @max-events/api-contracts, bookings/events/users, max-bot
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OFFER_TTL_MS - confirmation window
// - WaitlistService - join/confirm/expire/onSeatFreed
// - toWaitlistDto - entity plus FIFO position
// END_MODULE_MAP

import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, In, QueryFailedError, Repository } from "typeorm";
import type { WaitlistEntry, WaitlistStatus } from "@max-events/api-contracts";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import { MaxBotClient } from "../max-bot/max-bot.client";
import { UserEntity } from "../users/user.entity";
import { WaitlistEntryEntity } from "./waitlist-entry.entity";

export const OFFER_TTL_MS = 15 * 60 * 1000;
const QUEUE_STATUSES: WaitlistStatus[] = ["waiting", "offered"];

@Injectable()
export class WaitlistService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(WaitlistEntryEntity) private readonly entries: Repository<WaitlistEntryEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @Inject(MaxBotClient) private readonly bot: MaxBotClient,
  ) {}

  async join(userId: string, eventId: string): Promise<WaitlistEntry> {
    return this.dataSource.transaction(async (manager) => {
      const event = await manager.findOne(EventEntity, { where: { id: eventId }, lock: { mode: "pessimistic_write" } });
      if (!event) throw new NotFoundException("Event not found");
      if (event.capacity === null || event.bookedCount < event.capacity) {
        throw new ConflictException("Seats are still available");
      }
      const duplicate = await manager.findOne(WaitlistEntryEntity, { where: { userId, eventId, status: In(QUEUE_STATUSES) } });
      if (duplicate) throw new ConflictException("Already on the waitlist");
      const activeBooking = await manager.findOne(BookingEntity, { where: { userId, eventId, status: "active" } });
      if (activeBooking) throw new ConflictException("Already booked");
      const saved = await manager.save(WaitlistEntryEntity, manager.create(WaitlistEntryEntity, { userId, eventId, status: "waiting", offeredUntil: null }));
      return toWaitlistDto(saved, await positionOf(manager, saved));
    });
  }

  async confirm(userId: string, entryId: string, now = new Date()): Promise<WaitlistEntry> {
    return this.dataSource.transaction(async (manager) => {
      const entry = await manager.findOne(WaitlistEntryEntity, { where: { id: entryId }, lock: { mode: "pessimistic_write" } });
      if (!entry) throw new NotFoundException("Waitlist entry not found");
      if (entry.userId !== userId) throw new ForbiddenException("Cannot confirm another user's offer");
      if (entry.status !== "offered" || !entry.offeredUntil || entry.offeredUntil.getTime() <= now.getTime()) {
        throw new ConflictException("Offer is not active");
      }
      const event = await manager.findOne(EventEntity, { where: { id: entry.eventId }, lock: { mode: "pessimistic_write" } });
      if (!event) throw new NotFoundException("Event not found");
      try {
        await manager.save(BookingEntity, manager.create(BookingEntity, { userId, eventId: entry.eventId, status: "active" }));
      } catch (error) {
        if (error instanceof QueryFailedError && error.driverError?.code === "23505") {
          throw new ConflictException("Booking already exists");
        }
        throw error;
      }
      entry.status = "confirmed";
      entry.offeredUntil = null;
      const saved = await manager.save(WaitlistEntryEntity, entry);
      return toWaitlistDto(saved, 1);
    });
  }

  async onSeatFreed(manager: EntityManager, event: EventEntity, now = new Date(), reserveSeat = true): Promise<WaitlistEntryEntity | null> {
    const next = await manager.findOne(WaitlistEntryEntity, {
      where: { eventId: event.id, status: "waiting" },
      order: { createdAt: "ASC" },
      lock: { mode: "pessimistic_write" },
    });
    if (!next) return null;
    next.status = "offered";
    next.offeredUntil = new Date(now.getTime() + OFFER_TTL_MS);
    if (reserveSeat) {
      event.bookedCount += 1;
      await manager.save(EventEntity, event);
    }
    return manager.save(WaitlistEntryEntity, next);
  }

  async expireOffers(now = new Date()): Promise<number> {
    const due = await this.entries.find({ where: { status: "offered" } });
    let expired = 0;
    for (const entry of due) {
      if (!entry.offeredUntil || entry.offeredUntil.getTime() > now.getTime()) continue;
      const offered = await this.dataSource.transaction(async (manager) => {
        const locked = await manager.findOne(WaitlistEntryEntity, { where: { id: entry.id }, lock: { mode: "pessimistic_write" } });
        if (!locked || locked.status !== "offered") return null;
        locked.status = "expired";
        locked.offeredUntil = null;
        await manager.save(WaitlistEntryEntity, locked);
        const event = await manager.findOne(EventEntity, { where: { id: locked.eventId }, lock: { mode: "pessimistic_write" } });
        if (!event) return null;
        const next = await this.onSeatFreed(manager, event, now, false);
        if (!next) {
          event.bookedCount = Math.max(0, event.bookedCount - 1);
          await manager.save(EventEntity, event);
        }
        expired += 1;
        return next;
      });
      if (offered) await this.notifyOffer(offered);
    }
    return expired;
  }

  async notifyOffer(entry: WaitlistEntryEntity): Promise<void> {
    const user = await this.users.findOneBy({ id: entry.userId });
    if (!user || !entry.offeredUntil) return;
    const deadline = entry.offeredUntil.toISOString();
    await this.bot.sendMessage(user.maxUserId, `Место освободилось — подтверди до ${deadline}.`);
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

async function positionOf(manager: EntityManager, row: WaitlistEntryEntity): Promise<number> {
  const queue = await manager.find(WaitlistEntryEntity, { where: { eventId: row.eventId, status: In(["waiting", "offered"] satisfies WaitlistStatus[]) }, order: { createdAt: "ASC" } });
  const index = queue.findIndex((item) => item.id === row.id);
  return index < 0 ? queue.length + 1 : index + 1;
}
