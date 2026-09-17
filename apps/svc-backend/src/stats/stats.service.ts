// START_MODULE_CONTRACT
// PURPOSE: Page-view tracking with per-user per-day dedup and organizer event stats.
// SCOPE: recordView 23505-idempotent; eventStats views/bookings/cancels/paid for the owner only.
// DEPENDS: typeorm, @max-events/api-contracts, events/bookings, moscowDateKey
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - StatsService - recordView and eventStats
// END_MODULE_MAP

import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository } from "typeorm";
import type { OrganizerEventStats, PageViewTarget } from "@max-events/api-contracts";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import { moscowDateKey } from "../time/moscow-date";
import { PageViewEntity } from "./page-view.entity";

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(PageViewEntity) private readonly views: Repository<PageViewEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(BookingEntity) private readonly bookings: Repository<BookingEntity>,
  ) {}

  async recordView(userId: string, targetType: PageViewTarget, targetId: string, now = new Date()): Promise<{ recorded: boolean }> {
    try {
      await this.views.save(this.views.create({ userId, targetType, targetId, viewedOn: moscowDateKey(now) }));
      return { recorded: true };
    } catch (error) {
      if (error instanceof QueryFailedError && error.driverError?.code === "23505") return { recorded: false };
      throw error;
    }
  }

  async eventStats(actorId: string, eventId: string): Promise<OrganizerEventStats> {
    const event = await this.events.findOneBy({ id: eventId });
    if (!event) throw new NotFoundException("Event not found");
    if (event.organizerUserId !== actorId) throw new ForbiddenException("Not the organizer");
    const [viewRows, bookingRows] = await Promise.all([this.views.find({ where: { targetType: "event", targetId: eventId } }), this.bookings.find({ where: { eventId } })]);
    const bookings = bookingRows.length;
    const cancellations = bookingRows.filter((row) => row.status === "cancelled").length;
    const paidBookings = event.isPaid ? bookingRows.filter((row) => row.status === "active").length : 0;
    return { eventId, views: viewRows.length, bookings, cancellations, paidBookings };
  }
}
