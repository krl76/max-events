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
import type { OrganizerEventStats, OrganizerLeadBucket, OrganizerSummary, OrganizerTrafficSource, PageViewTarget, StatsPeriod } from "@max-events/api-contracts";
import { BookingEntity } from "../bookings/booking.entity";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import { isOrganizerOwner } from "../organizations/organizer-ownership";
import { moscowDateKey } from "../time/moscow-date";
import { WaitlistEntryEntity } from "../waitlist/waitlist-entry.entity";
import { PageViewEntity } from "./page-view.entity";

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(PageViewEntity) private readonly views: Repository<PageViewEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(BookingEntity) private readonly bookings: Repository<BookingEntity>,
    @InjectRepository(CheckInEntity) private readonly checkIns: Repository<CheckInEntity>,
    @InjectRepository(WaitlistEntryEntity) private readonly waitlist: Repository<WaitlistEntryEntity>,
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
    const viewRows = eventIds.size === 0 ? [] : (await this.views.find({ where: { targetType: "event" } })).filter((row) => eventIds.has(row.targetId) && inPeriod(row.createdAt, period));
    const views = viewRows.length;
    const periodEvents = mine.filter((event) => event.published !== false && event.startsAt instanceof Date && inPeriod(event.startsAt, period));
    const capped = periodEvents.filter((event) => event.capacity !== null && event.capacity > 0);
    const seatsCapacity = capped.reduce((sum, event) => sum + (event.capacity ?? 0), 0);
    const seatsBooked = capped.reduce((sum, event) => sum + Math.min(event.bookedCount ?? 0, event.capacity ?? 0), 0);
    const guestAll = new Map<string, number>();
    for (const row of allBookings) {
      if (!row.userId) continue;
      guestAll.set(row.userId, (guestAll.get(row.userId) ?? 0) + 1);
    }
    const periodGuests = new Set(inWindow.map((row) => row.userId).filter((id): id is string => typeof id === "string" && id !== ""));
    let returning = 0;
    let firstTimers = 0;
    for (const id of periodGuests) {
      const total = guestAll.get(id) ?? 0;
      if (total >= 2) returning += 1;
      else if (total === 1) firstTimers += 1;
    }
    const waiting = eventIds.size === 0 ? [] : (await this.waitlist.find()).filter((row) => eventIds.has(row.eventId) && (row.status === "waiting" || row.status === "offered"));
    const startsAtByEvent = new Map(mine.filter((event) => event.startsAt instanceof Date).map((event) => [event.id, event.startsAt]));
    const soldOut = capped.filter((event) => (event.bookedCount ?? 0) >= (event.capacity ?? 0)).length;
    return {
      bookings,
      bookingsDeltaPercent: previous === null || prevCount === 0 ? null : Math.round(((bookings - prevCount) / prevCount) * 100),
      attendedPercent: active === 0 ? null : Math.round((attended / active) * 100),
      cancelledPercent: bookings === 0 ? null : Math.round((cancelled / bookings) * 100),
      byWeekday,
      sources,
      views,
      conversionPercent: views === 0 ? null : Math.round((bookings / views) * 100),
      occupancyPercent: seatsCapacity === 0 ? null : Math.round((seatsBooked / seatsCapacity) * 100),
      seatsBooked,
      seatsCapacity,
      events: periodEvents.length,
      soldOut,
      uniqueGuests: periodGuests.size,
      repeatGuestPercent: periodGuests.size === 0 ? null : Math.round((returning / periodGuests.size) * 100),
      newGuestPercent: periodGuests.size === 0 ? null : Math.round((firstTimers / periodGuests.size) * 100),
      waitlist: waiting.length,
      lead: leadShares(inWindow, startsAtByEvent),
    };
  }

  exportCsv(summary: OrganizerSummary): string {
    const lines = [
      "metric,value",
      `bookings,${summary.bookings}`,
      `bookingsDeltaPercent,${summary.bookingsDeltaPercent ?? ""}`,
      `attendedPercent,${summary.attendedPercent ?? ""}`,
      `cancelledPercent,${summary.cancelledPercent ?? ""}`,
      `views,${summary.views}`,
      `conversionPercent,${summary.conversionPercent ?? ""}`,
      `occupancyPercent,${summary.occupancyPercent ?? ""}`,
      `seatsBooked,${summary.seatsBooked}`,
      `seatsCapacity,${summary.seatsCapacity}`,
      `events,${summary.events}`,
      `soldOut,${summary.soldOut}`,
      `uniqueGuests,${summary.uniqueGuests}`,
      `repeatGuestPercent,${summary.repeatGuestPercent ?? ""}`,
      `newGuestPercent,${summary.newGuestPercent ?? ""}`,
      `waitlist,${summary.waitlist}`,
      ...summary.byWeekday.map((count, index) => `weekday_${index + 1},${count}`),
      ...summary.sources.map((row) => `source_${row.source}_percent,${row.percent}`),
      ...summary.lead.map((row) => `lead_${row.bucket}_percent,${row.percent}`),
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

const LEAD_BUCKETS: OrganizerLeadBucket[] = ["same_day", "days_1_3", "days_4_7", "earlier"];

function moscowDayNumber(date: Date): number {
  const key = moscowDateKey(date);
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year ?? 2026, (month ?? 1) - 1, day ?? 1) / 86_400_000;
}

function leadBucket(bookedAt: Date, startsAt: Date): OrganizerLeadBucket | null {
  const diff = moscowDayNumber(startsAt) - moscowDayNumber(bookedAt);
  if (diff < 0) return null;
  if (diff === 0) return "same_day";
  if (diff <= 3) return "days_1_3";
  if (diff <= 7) return "days_4_7";
  return "earlier";
}

function leadShares(rows: Array<{ createdAt: Date; eventId: string }>, startsAtByEvent: Map<string, Date>): Array<{ bucket: OrganizerLeadBucket; percent: number }> {
  const counts: Record<OrganizerLeadBucket, number> = { same_day: 0, days_1_3: 0, days_4_7: 0, earlier: 0 };
  let total = 0;
  for (const row of rows) {
    const startsAt = startsAtByEvent.get(row.eventId);
    if (startsAt === undefined) continue;
    const bucket = leadBucket(row.createdAt, startsAt);
    if (bucket === null) continue;
    counts[bucket] += 1;
    total += 1;
  }
  return LEAD_BUCKETS.map((bucket) => ({ bucket, percent: total === 0 ? 0 : Math.round((counts[bucket] / total) * 100) }));
}
