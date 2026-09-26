// START_MODULE_CONTRACT
// PURPOSE: Organizer event-day options, attendance roster and waitlist invites.
// SCOPE: GET/PATCH options off the Event row; attendance from bookings/check-ins/waitlist; invites via WaitlistService.inviteNext.
// DEPENDS: typeorm, @max-events/api-contracts, events/bookings/check-ins/waitlist/users
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OrganizerDayService - options, attendance, inviteWaitlist
// END_MODULE_MAP

import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import type { OrganizerAttendance, OrganizerEventOptions, UpdateOrganizerEventOptions, WaitlistInviteResult } from "@max-events/api-contracts";
import { BookingEntity } from "../bookings/booking.entity";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import { isOrganizerOwner } from "../organizations/organizer-ownership";
import { UserEntity } from "../users/user.entity";
import { WaitlistEntryEntity } from "../waitlist/waitlist-entry.entity";
import { WaitlistService } from "../waitlist/waitlist.service";
import { EventOptionsEntity } from "./event-options.entity";

const QUEUE = ["waiting", "offered"] as const;

@Injectable()
export class OrganizerDayService {
  constructor(
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(EventOptionsEntity) private readonly options: Repository<EventOptionsEntity>,
    @InjectRepository(BookingEntity) private readonly bookings: Repository<BookingEntity>,
    @InjectRepository(CheckInEntity) private readonly checkIns: Repository<CheckInEntity>,
    @InjectRepository(WaitlistEntryEntity) private readonly waitlist: Repository<WaitlistEntryEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @Inject(WaitlistService) private readonly waitlistOffers: WaitlistService,
  ) {}

  async getOptions(actorId: string, eventId: string): Promise<OrganizerEventOptions> {
    await this.requireOwnedEvent(actorId, eventId);
    const row = await this.options.findOneBy({ eventId });
    return toOptions(eventId, row);
  }

  async updateOptions(actorId: string, eventId: string, patch: UpdateOrganizerEventOptions): Promise<OrganizerEventOptions> {
    await this.requireOwnedEvent(actorId, eventId);
    const existing = await this.options.findOneBy({ eventId });
    const current = toOptions(eventId, existing);
    const next = {
      waitlistEnabled: patch.waitlistEnabled ?? current.waitlistEnabled,
      registrationInApp: patch.registrationInApp ?? current.registrationInApp,
      externalUrl: patch.externalUrl !== undefined ? patch.externalUrl : current.externalUrl,
      recurrenceRule: patch.recurrence !== undefined ? (patch.recurrence?.rule ?? null) : (current.recurrence?.rule ?? null),
      recurrenceUntil: patch.recurrence !== undefined ? (patch.recurrence ? new Date(patch.recurrence.until) : null) : current.recurrence ? new Date(current.recurrence.until) : null,
    };
    const saved = existing ? await this.options.save(this.options.merge(existing, next)) : await this.options.save(this.options.create({ eventId, ...next }));
    return toOptions(eventId, saved);
  }

  async attendance(actorId: string, eventId: string): Promise<OrganizerAttendance> {
    const event = await this.requireOwnedEvent(actorId, eventId);
    const [active, cancelled, arrivals, queue] = await Promise.all([this.bookings.find({ where: { eventId, status: "active" } }), this.bookings.find({ where: { eventId, status: "cancelled" } }), this.checkIns.find({ where: { eventId } }), this.waitlist.find({ where: { eventId, status: In([...QUEUE]) } })]);
    const userIds = [...new Set([...active.map((row) => row.userId), ...queue.map((row) => row.userId)])];
    const people = userIds.length === 0 ? [] : await this.users.find({ where: { id: In(userIds) } });
    const nameById = new Map(people.map((user) => [user.id, user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName]));
    const checkedInAt = new Map(arrivals.filter((row) => row.userId).map((row) => [row.userId, row.checkedInAt.toISOString()]));
    return {
      eventId,
      capacity: event.capacity,
      bookedCount: event.bookedCount,
      waitlistCount: queue.length,
      checkedInCount: arrivals.length,
      freedSeats: cancelled.length,
      chatMessages: null,
      participants: active.map((row) => ({
        bookingId: row.id,
        userId: row.userId,
        name: nameById.get(row.userId) ?? "Гость",
        guests: 1,
        checkedInAt: checkedInAt.get(row.userId) ?? null,
        bookedAt: row.createdAt.toISOString(),
      })),
      waitlist: queue.map((row) => ({
        entryId: row.id,
        userId: row.userId,
        name: nameById.get(row.userId) ?? "Гость",
        guests: 1,
        joinedAt: row.createdAt.toISOString(),
      })),
      slots: [],
    };
  }

  async inviteWaitlist(actorId: string, eventId: string, count: number): Promise<WaitlistInviteResult> {
    await this.requireOwnedEvent(actorId, eventId);
    const invited = await this.waitlistOffers.inviteNext(eventId, count);
    return { invited };
  }

  private async requireOwnedEvent(actorId: string, eventId: string): Promise<EventEntity> {
    const event = await this.events.findOneBy({ id: eventId });
    if (!event) throw new NotFoundException("Event not found");
    if (!isOrganizerOwner(event, actorId)) throw new ForbiddenException("Not the organizer");
    return event;
  }
}

function toOptions(eventId: string, row: EventOptionsEntity | null): OrganizerEventOptions {
  return {
    eventId,
    waitlistEnabled: row?.waitlistEnabled ?? true,
    registrationInApp: row?.registrationInApp ?? true,
    externalUrl: row?.externalUrl ?? null,
    recurrence: row?.recurrenceRule === "weekly" && row.recurrenceUntil ? { rule: "weekly", until: row.recurrenceUntil.toISOString() } : null,
  };
}
