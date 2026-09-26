// START_MODULE_CONTRACT
// PURPOSE: Page-view tracking with per-user per-day dedup and organizer event stats.
// SCOPE: recordView 23505-idempotent; eventStats views/bookings/cancels/paid for the owner only, over an optional from/to period.
// DEPENDS: typeorm, @max-events/api-contracts, events/bookings, moscowDateKey
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - StatsService - recordView and eventStats
// - inPeriod - createdAt inside an optional inclusive from/to window
// END_MODULE_MAP

import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository } from "typeorm";
import type { OrganizerEventStats, OrganizerSummary, OrganizerTrafficSource, PageViewTarget, StatsPeriod } from "@max-events/api-contracts";
import { BookingEntity } from "../bookings/booking.entity";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import { isOrganizerOwner } from "../organizations/organizer-ownership";
import { moscowDateKey } from "../time/moscow-date";
import { PageViewEntity } from "./page-view.entity";

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(PageViewEntity) private readonly views: Repository<PageViewEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(BookingEntity) private readonly bookings: Repository<BookingEntity>,
    @InjectRepository(CheckInEntity) private readonly checkIns: Repository<CheckInEntity>,
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

  /**
   * Counters for one event. A period narrows every counter to what was recorded inside it: views by
   * when they were seen, bookings by when they were made (a cancellation is counted against the
   * period the booking belongs to, so bookings and cancellations always describe the same rows).
   */
  async eventStats(actorId: string, eventId: string, period: StatsPeriod = ALL_TIME): Promise<OrganizerEventStats> {
    const event = await this.events.findOneBy({ id: eventId });
    if (!event) throw new NotFoundException("Event not found");
    if (!isOrganizerOwner(event, actorId)) throw new ForbiddenException("Not the organizer");
    const [allViews, allBookings] = await Promise.all([this.views.find({ where: { targetType: "event", targetId: eventId } }), this.bookings.find({ where: { eventId } })]);
    const viewRows = allViews.filter((row) => inPeriod(row.createdAt, period));
    const bookingRows = allBookings.filter((row) => inPeriod(row.createdAt, period));
    const bookings = bookingRows.length;
    const cancellations = bookingRows.filter((row) => row.status === "cancelled").length;
    const paidBookings = event.isPaid ? bookingRows.filter((row) => row.status === "active").length : 0;
    return { eventId, period, views: viewRows.length, bookings, cancellations, paidBookings };
  }

  async organizationSummary(organizationId: string, period: StatsPeriod = ALL_TIME): Promise<OrganizerSummary> {
    const owned = await this.events.find();
    const mine = owned.filter((row) => isOrganizerOwner(row, organizationId));
    const eventIds = new Set(mine.map((row) => row.id));
    const allBookings = eventIds.size === 0 ? [] : (await this.bookings.find()).filter((row) => eventIds.has(row.eventId));
    const inWindow = allBookings.filter((row) => inPeriod(row.createdAt, period));
    const previous = previousPeriod(period);
    const prevWindow = previous === null ? [] : allBookings.filter((row) => inPeriod(row.createdAt, previous));
    const bookings = inWindow.length;
    const cancelled = inWindow.filter((row) => row.status === "cancelled").length;
    const activeIds = inWindow.filter((row) => row.status === "active").map((row) => row.eventId);
    const checkIns = activeIds.length === 0 ? [] : (await this.checkIns.find()).filter((row) => row.eventId !== null && activeIds.includes(row.eventId));
    const attended = new Set(checkIns.map((row) => `${row.userId}:${row.eventId}`)).size;
    const active = bookings - cancelled;
    const byWeekday = [0, 0, 0, 0, 0, 0, 0];
    for (const row of inWindow) byWeekday[moscowWeekdayMon0(row.createdAt)] += 1;
    const attributed = inWindow.filter((row) => row.source === "chats" || row.source === "feed" || row.source === "search");
    const counts: Record<OrganizerTrafficSource, number> = { chats: 0, feed: 0, search: 0 };
    for (const row of attributed) counts[row.source as OrganizerTrafficSource] += 1;
    const attributedTotal = attributed.length;
    const sources = (["chats", "feed", "search"] as const).map((source) => ({
      source,
      percent: attributedTotal === 0 ? 0 : Math.round((counts[source] / attributedTotal) * 100),
    }));
    const prevCount = prevWindow.length;
    return {
      bookings,
      bookingsDeltaPercent: previous === null || prevCount === 0 ? null : Math.round(((bookings - prevCount) / prevCount) * 100),
      attendedPercent: active === 0 ? null : Math.round((attended / active) * 100),
      cancelledPercent: bookings === 0 ? null : Math.round((cancelled / bookings) * 100),
      byWeekday,
      sources,
    };
  }

  exportCsv(summary: OrganizerSummary): string {
    const lines = [
      "metric,value",
      `bookings,${summary.bookings}`,
      `bookingsDeltaPercent,${summary.bookingsDeltaPercent ?? ""}`,
      `attendedPercent,${summary.attendedPercent ?? ""}`,
      `cancelledPercent,${summary.cancelledPercent ?? ""}`,
      ...summary.byWeekday.map((count, index) => `weekday_${index + 1},${count}`),
      ...summary.sources.map((row) => `source_${row.source}_percent,${row.percent}`),
    ];
    return `${lines.join("\n")}\n`;
  }
}

const ALL_TIME: StatsPeriod = { from: null, to: null };

export function inPeriod(at: Date, period: StatsPeriod): boolean {
  if (period.from !== null && at.getTime() < new Date(period.from).getTime()) return false;
  if (period.to !== null && at.getTime() > new Date(period.to).getTime()) return false;
  return true;
}

function previousPeriod(period: StatsPeriod): StatsPeriod | null {
  if (period.from === null || period.to === null) return null;
  const from = new Date(period.from).getTime();
  const to = new Date(period.to).getTime();
  const span = to - from;
  if (span <= 0) return null;
  return { from: new Date(from - span).toISOString(), to: new Date(from).toISOString() };
}

function moscowWeekdayMon0(date: Date): number {
  const key = moscowDateKey(date);
  const [year, month, day] = key.split("-").map(Number);
  const noon = new Date(Date.UTC(year ?? 2026, (month ?? 1) - 1, day ?? 1, 12));
  return (noon.getUTCDay() + 6) % 7;
}
