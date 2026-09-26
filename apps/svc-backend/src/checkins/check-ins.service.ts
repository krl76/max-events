// START_MODULE_CONTRACT
// PURPOSE: Check-in «Я здесь» — event or place, per-visit dedup, visit statistics, organizer door codes.
// SCOPE: Event unique per user; place unique per user+UTC day; concurrent inserts resolve to the winning row (23505); stats unique places (incl. event.placeId), their districts and per-category event counts; listCodes / checkInByCode for the ticket code.
// DEPENDS: @nestjs/common, @nestjs/typeorm, typeorm, @max-events/api-contracts, events/places, mycity/districtKey
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CheckInCode - one booking and the code its holder shows at the door
// - OrganizerGuestCheckIn - one guest in the organizer's door list: who, how many, booked when, checked in when
// - utcVisitDate - YYYY-MM-DD from a Date
// - toCheckInDto - entity to CheckIn contract
// - CheckInsService - create, stats, listCodes, checkInByCode
// END_MODULE_MAP

import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, QueryFailedError, Repository } from "typeorm";
import { EventCategorySchema, type CheckIn, type CreateCheckInWrite, type EventCategory, type VisitStats } from "@max-events/api-contracts";
import { BookingEntity } from "../bookings/booking.entity";
import { EventEntity } from "../events/event.entity";
import { isOrganizerOwner } from "../organizations/organizer-ownership";
import { districtKey } from "../mycity/my-city.service";
import { PlaceEntity } from "../places/place.entity";
import { UsersService } from "../users/users.service";
import { CheckInEntity } from "./check-in.entity";
import { entryCodeFromBookingId, normalizeEntryCode } from "./entry-code";

export type CheckInCode = { bookingId: string; code: string };

export type OrganizerGuestCheckIn = {
  bookingId: string;
  userId: string;
  name: string;
  guests: number;
  checkedInAt: string | null;
  bookedAt: string;
};

export function utcVisitDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

@Injectable()
export class CheckInsService {
  constructor(
    @InjectRepository(CheckInEntity) private readonly checkIns: Repository<CheckInEntity>,
    @InjectRepository(EventEntity) private readonly events: Repository<EventEntity>,
    @InjectRepository(PlaceEntity) private readonly places: Repository<PlaceEntity>,
    @InjectRepository(BookingEntity) private readonly bookings: Repository<BookingEntity>,
    @Inject(UsersService) private readonly users: UsersService,
  ) {}

  private progressHook: ((userId: string, before: VisitStats) => Promise<void>) | null = null;

  /** Achievements registers this on boot. A missing hook leaves check-in behaviour unchanged. */
  setProgressHook(hook: (userId: string, before: VisitStats) => Promise<void>): void {
    this.progressHook = hook;
  }

  async create(userId: string, payload: CreateCheckInWrite, now = new Date()): Promise<CheckIn> {
    if (payload.eventId) {
      const eventId = payload.eventId;
      const event = await this.events.findOneBy({ id: eventId });
      if (!event) throw new NotFoundException("Event not found");
      const match = (row: CheckInEntity) => row.eventId === eventId;
      const existing = await this.findMine(userId, match);
      if (existing) return toCheckInDto(existing);
      return toCheckInDto(await this.insertFresh(userId, { userId, eventId, placeId: null, visitDate: null }, match));
    }
    const placeId = payload.placeId!;
    const place = await this.places.findOneBy({ id: placeId });
    if (!place) throw new NotFoundException("Place not found");
    const day = utcVisitDate(now);
    const match = (row: CheckInEntity) => row.placeId === placeId && row.visitDate === day;
    const existing = await this.findMine(userId, match);
    if (existing) return toCheckInDto(existing);
    return toCheckInDto(await this.insertFresh(userId, { userId, eventId: null, placeId, visitDate: day }, match));
  }

  private async findMine(userId: string, match: (row: CheckInEntity) => boolean): Promise<CheckInEntity | undefined> {
    return (await this.checkIns.find({ where: { userId } })).find(match);
  }

  // The unique indexes (user+event, user+place+day) are the real gate: a parallel double-click
  // loses the insert race and must read back the winner instead of surfacing a 500.
  private async insertFresh(userId: string, fields: Partial<CheckInEntity>, match: (row: CheckInEntity) => boolean): Promise<CheckInEntity> {
    const before = this.progressHook ? await this.stats(userId, userId) : null;
    const saved = await this.insertOrExisting(userId, fields, match);
    if (before && this.progressHook) {
      try {
        await this.progressHook(userId, before);
      } catch {
        // The visit is stored. The bell line can wait until the next check-in.
      }
    }
    return saved;
  }

  private async insertOrExisting(userId: string, fields: Partial<CheckInEntity>, match: (row: CheckInEntity) => boolean): Promise<CheckInEntity> {
    try {
      return await this.checkIns.save(this.checkIns.create(fields));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const winner = await this.findMine(userId, match);
      if (!winner) throw error;
      return winner;
    }
  }

  async listCodes(userId: string): Promise<CheckInCode[]> {
    const rows = await this.bookings.find({ where: { userId, status: "active" }, order: { createdAt: "ASC" } });
    return rows.map((row) => ({ bookingId: row.id, code: entryCodeFromBookingId(row.id) }));
  }

  async checkInByCode(actorId: string, eventId: string, code: string, now = new Date()): Promise<OrganizerGuestCheckIn> {
    const wanted = normalizeEntryCode(code);
    if (wanted.length === 0) throw new BadRequestException("Invalid check-in code");
    const event = await this.events.findOneBy({ id: eventId });
    if (!event) throw new NotFoundException("Event not found");
    if (!isOrganizerOwner(event, actorId)) throw new ForbiddenException("Not the organizer");
    const rows = await this.bookings.find({ where: { eventId, status: "active" } });
    const matches = rows.filter((row) => entryCodeFromBookingId(row.id) === wanted);
    if (matches.length > 1) throw new ConflictException("Ambiguous check-in code");
    const booking = matches[0];
    if (!booking) throw new NotFoundException("Guest not found");
    const checkIn = await this.create(booking.userId, { eventId }, now);
    const [user] = await this.users.findByIds([booking.userId]);
    const name = user ? (user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName) : "Гость";
    return {
      bookingId: booking.id,
      userId: booking.userId,
      name,
      guests: 0,
      checkedInAt: checkIn.checkedInAt,
      bookedAt: booking.createdAt.toISOString(),
    };
  }

  async stats(userId: string, requesterId: string): Promise<VisitStats> {
    if (userId !== requesterId) throw new ForbiddenException("Cannot read another user's visit stats");
    const mine = await this.checkIns.find({ where: { userId } });
    const events = await this.events.find();
    const eventById = new Map(events.map((row) => [row.id, row]));
    const placeIds = new Set<string>();
    const byCategory = new Map<EventCategory, number>();
    for (const row of mine) {
      if (row.placeId) placeIds.add(row.placeId);
      if (!row.eventId) continue;
      const event = eventById.get(row.eventId);
      if (!event) continue;
      if (event.placeId) placeIds.add(event.placeId);
      byCategory.set(event.category, (byCategory.get(event.category) ?? 0) + 1);
    }
    // Districts are the neighbourhood cells of the visited places, the same cells «Мой город» counts.
    const visited = placeIds.size === 0 ? [] : await this.places.find({ where: { id: In([...placeIds]) } });
    const districts = new Set(visited.map((place) => districtKey(place.latitude, place.longitude)));
    return {
      userId,
      placesCount: placeIds.size,
      eventsCount: mine.filter((row) => row.eventId !== null).length,
      districtsCount: districts.size,
      byCategory: EventCategorySchema.options.map((category) => ({ category, count: byCategory.get(category) ?? 0 })),
    };
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof QueryFailedError && error.driverError?.code === "23505";
}

export function toCheckInDto(row: CheckInEntity): CheckIn {
  return {
    id: row.id,
    userId: row.userId,
    eventId: row.eventId,
    placeId: row.placeId,
    checkedInAt: row.checkedInAt.toISOString(),
  };
}
