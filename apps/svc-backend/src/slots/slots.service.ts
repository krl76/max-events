// START_MODULE_CONTRACT
// PURPOSE: Venue slot grid — default week windows, booking with party size and extras, own bookings list.
// SCOPE: GET /slots generates a 7-day grid if none exist; POST/DELETE slot bookings; takenSeats vs capacity.
// DEPENDS: typeorm, @max-events/api-contracts, places, friends, moscow-date
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - SlotsService - board, book, cancel, mine, upcoming
// END_MODULE_MAP

import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { IdSchema } from "@max-events/api-contracts";
import { InjectRepository } from "@nestjs/typeorm";
import { In, QueryFailedError, Repository } from "typeorm";
import { FriendsService } from "../friends/friends.service";
import { PlaceEntity } from "../places/place.entity";
import { toPlaceDto } from "../places/places.service";
import { moscowDateKey } from "../time/moscow-date";
import { PlaceSlotEntity, SlotBookingEntity } from "./slot.entity";

const WINDOWS = [
  { start: "14:00", end: "17:00" },
  { start: "17:30", end: "20:30" },
  { start: "21:00", end: "23:30" },
] as const;
const DEFAULT_CAPACITY = 12;
const UNIT_TITLE = "Площадка";

export type SlotStatus = "free" | "held" | "booked";

@Injectable()
export class SlotsService {
  constructor(
    @InjectRepository(PlaceSlotEntity) private readonly slots: Repository<PlaceSlotEntity>,
    @InjectRepository(SlotBookingEntity) private readonly bookings: Repository<SlotBookingEntity>,
    @InjectRepository(PlaceEntity) private readonly places: Repository<PlaceEntity>,
    @Inject(FriendsService) private readonly friends: FriendsService,
  ) {}

  async board(placeId: string, viewerId: string, date?: string, now = new Date()) {
    const place = await this.requirePlace(placeId);
    await this.ensureWeek(place.id, now);
    const days = this.weekKeys(now);
    const asked = date && days.includes(date) ? date : days[0]!;
    const weekSlots = await this.slots.find({ where: { placeId: place.id } });
    const ofDay = weekSlots.filter((row) => moscowDateKey(row.startsAt) === asked).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    const friends = await this.friends.list(viewerId);
    return {
      place: toPlaceDto(place),
      unitTitle: UNIT_TITLE,
      pricePerHourRub: null,
      cancelBefore: null,
      amenities: [],
      extras: [],
      days: days.map((key) => ({
        date: key,
        weather: null,
        hasFreeSlots: weekSlots.some((row) => moscowDateKey(row.startsAt) === key && row.takenSeats < row.capacity),
      })),
      date: asked,
      slots: ofDay.map(toPlaceSlot),
      company: [],
      candidates: friends,
    };
  }

  async upcoming(placeId: string, limit = 3, now = new Date()) {
    await this.requirePlace(placeId);
    await this.ensureWeek(placeId, now);
    const rows = (await this.slots.find({ where: { placeId } })).filter((row) => row.startsAt.getTime() >= now.getTime() && row.takenSeats < row.capacity);
    return rows.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()).slice(0, limit).map(toPlaceSlot);
  }

  async book(userId: string, slotId: string, companionIds: string[] = [], extraIds: string[] = []) {
    const companions = companionIds.filter((id) => IdSchema.safeParse(id).success);
    const extras = extraIds.filter((id) => IdSchema.safeParse(id).success);
    const slot = await this.slots.findOneBy({ id: slotId });
    if (!slot) throw new NotFoundException("Slot not found");
    await this.requirePlace(slot.placeId);
    const partySize = 1 + companions.length;
    if (slot.takenSeats + partySize > slot.capacity) throw new ConflictException("No seats left");
    const duplicate = await this.bookings.findOneBy({ slotId, userId, status: "active" });
    if (duplicate) throw new ConflictException("Booking already exists");
    slot.takenSeats += partySize;
    await this.slots.save(slot);
    try {
      const saved = await this.bookings.save(
        this.bookings.create({
          slotId: slot.id,
          placeId: slot.placeId,
          userId,
          status: "active",
          partySize,
          extraIds: extras,
          totalRub: slot.priceRub ?? 0,
          cancelBefore: slot.startsAt,
        }),
      );
      return toSlotBooking(saved, slot);
    } catch (error) {
      slot.takenSeats = Math.max(0, slot.takenSeats - partySize);
      await this.slots.save(slot);
      if (error instanceof QueryFailedError && (error as { driverError?: { code?: string } }).driverError?.code === "23505") throw new ConflictException("Booking already exists");
      throw error;
    }
  }

  async getBooking(userId: string, bookingId: string) {
    const booking = await this.bookings.findOneBy({ id: bookingId });
    if (!booking || booking.userId !== userId) throw new NotFoundException("Booking not found");
    const slot = await this.slots.findOneBy({ id: booking.slotId });
    if (!slot) throw new NotFoundException("Slot not found");
    const place = await this.requirePlace(slot.placeId);
    const friends = await this.friends.list(userId);
    return {
      booking: toSlotBooking(booking, slot),
      slot: toPlaceSlot(slot),
      place: toPlaceDto(place),
      unitTitle: slot.unitTitle,
      company: friends.slice(0, Math.max(0, booking.partySize - 1)),
      freeSeats: Math.max(0, slot.capacity - slot.takenSeats),
      distanceKm: null,
      travelMinutes: null,
      chat: [],
    };
  }

  async cancel(userId: string, bookingId: string) {
    const booking = await this.bookings.findOneBy({ id: bookingId });
    if (!booking) throw new NotFoundException("Booking not found");
    if (booking.userId !== userId) throw new ForbiddenException("Cannot cancel another user's booking");
    const slot = await this.slots.findOneBy({ id: booking.slotId });
    if (!slot) throw new NotFoundException("Slot not found");
    await this.requirePlace(slot.placeId);
    if (booking.status === "cancelled") return toSlotBooking(booking, slot);
    booking.status = "cancelled";
    slot.takenSeats = Math.max(0, slot.takenSeats - booking.partySize);
    await this.slots.save(slot);
    await this.bookings.save(booking);
    return toSlotBooking(booking, slot);
  }

  async mine(userId: string) {
    const rows = await this.bookings.find({ where: { userId } });
    const slotIds = [...new Set(rows.map((row) => row.slotId))];
    const slots = slotIds.length === 0 ? [] : await this.slots.find({ where: { id: In(slotIds) } });
    const slotById = new Map(slots.map((row) => [row.id, row]));
    const placeIds = [...new Set(slots.map((row) => row.placeId))];
    const places = placeIds.length === 0 ? [] : (await this.places.find({ where: { id: In(placeIds) } })).filter((row) => row.published !== false);
    const placeById = new Map(places.map((row) => [row.id, row]));
    const bookings = rows
      .filter((row) => row.status === "active")
      .flatMap((row) => {
        const slot = slotById.get(row.slotId);
        const place = slot ? placeById.get(slot.placeId) : undefined;
        if (!slot || !place) return [];
        return [{ booking: toSlotBooking(row, slot), slot: toPlaceSlot(slot), place: toPlaceDto(place), unitTitle: slot.unitTitle, activity: place.category, company: [] }];
      });
    return { bookings, waitlist: [] };
  }

  private async requirePlace(placeId: string): Promise<PlaceEntity> {
    const place = await this.places.findOneBy({ id: placeId });
    if (!place || place.published === false) throw new NotFoundException("Place not found");
    return place;
  }

  private async ensureWeek(placeId: string, now: Date): Promise<void> {
    const keys = this.weekKeys(now);
    const existing = await this.slots.find({ where: { placeId } });
    const have = new Set(existing.map((row) => `${moscowDateKey(row.startsAt)}-${row.startsAt.toISOString()}`));
    for (const key of keys) {
      for (const window of WINDOWS) {
        const startsAt = new Date(`${key}T${window.start}:00+03:00`);
        const endsAt = new Date(`${key}T${window.end}:00+03:00`);
        const stamp = `${key}-${startsAt.toISOString()}`;
        if (have.has(stamp)) continue;
        try {
          await this.slots.save(this.slots.create({ placeId, startsAt, endsAt, capacity: DEFAULT_CAPACITY, takenSeats: 0, priceRub: null, unitTitle: UNIT_TITLE }));
        } catch (error) {
          if (!(error instanceof QueryFailedError && (error as { driverError?: { code?: string } }).driverError?.code === "23505")) throw error;
        }
      }
    }
  }

  private weekKeys(now: Date): string[] {
    const start = moscowDateKey(now);
    const keys = [start];
    const [year, month, day] = start.split("-").map(Number);
    for (let offset = 1; offset < 7; offset += 1) {
      const next = new Date(Date.UTC(year ?? 2026, (month ?? 1) - 1, (day ?? 1) + offset));
      keys.push(next.toISOString().slice(0, 10));
    }
    return keys;
  }
}

function toPlaceSlot(row: PlaceSlotEntity) {
  const status: SlotStatus = row.takenSeats >= row.capacity ? "booked" : row.takenSeats > 0 ? "held" : "free";
  return {
    id: row.id,
    placeId: row.placeId,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    capacity: row.capacity,
    takenSeats: row.takenSeats,
    priceRub: row.priceRub,
    status,
    busyUntil: status === "free" ? null : row.endsAt.toISOString(),
    weather: null,
  };
}

function toSlotBooking(row: SlotBookingEntity, slot: PlaceSlotEntity) {
  return {
    id: row.id,
    slotId: row.slotId,
    placeId: row.placeId,
    userId: row.userId,
    status: row.status,
    checkInCode: `MAX-${row.id.replace(/-/g, "").slice(-8).toUpperCase()}`,
    partySize: row.partySize,
    extraIds: row.extraIds ?? [],
    totalRub: row.totalRub,
    cancelBefore: row.cancelBefore ? row.cancelBefore.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}


