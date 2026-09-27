// START_MODULE_CONTRACT
// PURPOSE: Personal calendar — active bookings of the current user split by event start into upcoming/past, plus the calendar shared with a friend.
// SCOPE: list(userId, now, range) joins booking+event+optional place in three queries; cancelled bookings omitted; optional from/to filters by event start. shared() projects peer bookings, invite token, going RSVPs; addPeer is mutual; revoke drops both directions.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, node:crypto, @max-events/api-contracts, bookings/events/places/users entities, friends, calendar share/invite/going entities
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CalendarRange - optional inclusive from/to window on event start
// - parseCalendarRange - from/to query into a CalendarRange or 400
// - CalendarService - list upcoming/past; shared calendar, peers, invite, going
// END_MODULE_MAP

import { randomUUID } from "node:crypto";
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { TimestampSchema, type Booking, type CalendarEntry, type CalendarResponse, type SharedCalendar } from "@max-events/api-contracts";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import { toEventDto } from "../events/events.service";
import { FriendsService, toFriendDto } from "../friends/friends.service";
import { PlaceEntity } from "../places/place.entity";
import { toPlaceDto } from "../places/places.service";
import { miniappLink } from "../time/human-when";
import { UserEntity } from "../users/user.entity";
import { CalendarGoingEntity } from "./calendar-going.entity";
import { CalendarInviteEntity } from "./calendar-invite.entity";
import { CalendarShareEntity } from "./calendar-share.entity";

export type CalendarRange = { from: Date | null; to: Date | null };

export function parseCalendarRange(query: Record<string, string | undefined>): CalendarRange {
  const from = parseBound(query.from);
  const to = parseBound(query.to);
  if (from !== null && to !== null && from.getTime() > to.getTime()) throw new BadRequestException("Invalid calendar range");
  return { from, to };
}

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(BookingEntity) private readonly bookings: Repository<BookingEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(PlaceEntity) private readonly places: Repository<PlaceEntity>,
    @InjectRepository(CalendarShareEntity) private readonly shares: Repository<CalendarShareEntity>,
    @InjectRepository(CalendarInviteEntity) private readonly invites: Repository<CalendarInviteEntity>,
    @InjectRepository(CalendarGoingEntity) private readonly goings: Repository<CalendarGoingEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @Inject(FriendsService) private readonly friends: FriendsService,
  ) {}

  async list(userId: string, now = new Date(), range: CalendarRange = { from: null, to: null }): Promise<CalendarResponse> {
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
      if (!inRange(event.startsAt, range)) continue;
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

  async shared(userId: string, range: CalendarRange = { from: null, to: null }, _host: string | null = null): Promise<SharedCalendar> {
    const granted = await this.shares.find({ where: { ownerUserId: userId } });
    const incoming = await this.shares.find({ where: { peerUserId: userId } });
    const peerIds = [...new Set(granted.map((row) => row.peerUserId))];
    const ownerIds = [...new Set(incoming.map((row) => row.ownerUserId))];
    const userIds = [...new Set([...peerIds, ...ownerIds])];
    const users = userIds.length === 0 ? [] : await this.users.find({ where: { id: In(userIds) } });
    const userById = new Map(users.map((row) => [row.id, row]));
    const peers = granted.flatMap((row) => {
      const user = userById.get(row.peerUserId);
      return user ? [{ friend: toFriendDto(user), canEdit: row.canEdit }] : [];
    });
    const bookings = ownerIds.length === 0 ? [] : await this.bookings.find({ where: { userId: In(ownerIds), status: "active" } });
    const eventIds = [...new Set(bookings.map((row) => row.eventId))];
    const events = eventIds.length === 0 ? [] : await this.events.find({ where: { id: In(eventIds), published: true } });
    const eventById = new Map(events.map((row) => [row.id, row]));
    const myBookings = await this.bookings.find({ where: { userId, status: "active" } });
    const myEventIds = new Set(myBookings.map((row) => row.eventId));
    const rsvps = eventIds.length === 0 ? [] : await this.goings.find({ where: { userId, eventId: In(eventIds) } });
    const rsvpEventIds = new Set(rsvps.map((row) => row.eventId));
    const entries = bookings.flatMap((booking) => {
      const event = eventById.get(booking.eventId);
      const owner = userById.get(booking.userId);
      if (!event || !owner || !inRange(event.startsAt, range)) return [];
      const bothGoing = myEventIds.has(event.id) || rsvpEventIds.has(event.id);
      return [
        {
          id: booking.id,
          owner: toFriendDto(owner),
          title: event.title,
          startsAt: event.startsAt.toISOString(),
          endsAt: event.endsAt ? event.endsAt.toISOString() : null,
          bothGoing,
          needsResponse: !bothGoing,
          eventId: event.id,
        },
      ];
    });
    entries.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return { peers, entries, inviteUrl: await this.inviteUrlFor(userId) };
  }

  async addPeer(userId: string, peerId: string, canEdit = true, host: string | null = null): Promise<SharedCalendar> {
    if (peerId === userId) throw new BadRequestException("Invalid calendar payload");
    const allowed = await this.friends.friendIds(userId);
    if (!allowed.has(peerId)) throw new BadRequestException("Invalid calendar payload");
    await this.ensureShare(userId, peerId, canEdit);
    await this.ensureShare(peerId, userId, canEdit, false);
    return this.shared(userId, { from: null, to: null }, host);
  }

  async revokePeer(userId: string, peerId: string, host: string | null = null): Promise<SharedCalendar> {
    const mine = await this.shares.findOneBy({ ownerUserId: userId, peerUserId: peerId });
    if (!mine) throw new NotFoundException("Share not found");
    await this.shares.delete({ id: mine.id });
    const reverse = await this.shares.findOneBy({ ownerUserId: peerId, peerUserId: userId });
    if (reverse) await this.shares.delete({ id: reverse.id });
    return this.shared(userId, { from: null, to: null }, host);
  }

  async acceptInvite(userId: string, token: string, host: string | null = null): Promise<SharedCalendar> {
    const invite = await this.invites.findOneBy({ token });
    if (!invite) throw new NotFoundException("Invite not found");
    if (invite.userId === userId) throw new BadRequestException("Invalid calendar payload");
    await this.ensureShare(invite.userId, userId, true);
    await this.ensureShare(userId, invite.userId, true, false);
    return this.shared(userId, { from: null, to: null }, host);
  }

  async going(userId: string, bookingId: string, host: string | null = null): Promise<SharedCalendar> {
    const booking = await this.bookings.findOneBy({ id: bookingId });
    if (!booking || booking.status !== "active" || booking.userId === userId) throw new NotFoundException("Entry not found");
    const event = await this.events.findOneBy({ id: booking.eventId });
    if (!event || event.published === false) throw new NotFoundException("Entry not found");
    const share = await this.shares.findOneBy({ ownerUserId: booking.userId, peerUserId: userId });
    if (!share) throw new NotFoundException("Entry not found");
    if (!share.canEdit) throw new ForbiddenException("Calendar is view-only");
    const existing = await this.goings.findOneBy({ userId, eventId: booking.eventId });
    if (!existing) await this.goings.save(this.goings.create({ userId, eventId: booking.eventId }));
    return this.shared(userId, { from: null, to: null }, host);
  }

  private async ensureShare(ownerUserId: string, peerUserId: string, canEdit: boolean, overwrite = true): Promise<void> {
    const existing = await this.shares.findOneBy({ ownerUserId, peerUserId });
    if (existing) {
      if (overwrite && existing.canEdit !== canEdit) {
        existing.canEdit = canEdit;
        await this.shares.save(existing);
      }
      return;
    }
    await this.shares.save(this.shares.create({ ownerUserId, peerUserId, canEdit }));
  }

  private async inviteUrlFor(userId: string): Promise<string> {
    let invite = await this.invites.findOneBy({ userId });
    if (!invite) {
      invite = await this.invites.save(this.invites.create({ userId, token: randomUUID() }));
    }
    // The website path opened a browser tab. startapp=calendar-<token> opens the bot on that invite.
    return miniappLink(`calendar-${invite.token}`) ?? `calendar-${invite.token}`;
  }
}

function parseBound(raw: string | undefined): Date | null {
  if (raw === undefined || raw === "") return null;
  const parsed = TimestampSchema.safeParse(raw);
  if (!parsed.success) throw new BadRequestException("Invalid calendar range");
  return new Date(parsed.data);
}

function inRange(startsAt: Date, range: CalendarRange): boolean {
  const at = startsAt.getTime();
  if (range.from !== null && at < range.from.getTime()) return false;
  if (range.to !== null && at > range.to.getTime()) return false;
  return true;
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
