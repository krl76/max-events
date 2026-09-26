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

import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { IdSchema } from "@max-events/api-contracts";
import { InjectRepository } from "@nestjs/typeorm";
import { In, QueryFailedError, Repository } from "typeorm";
import { FriendsService } from "../friends/friends.service";
import { isOrganizerOwner } from "../organizations/organizer-ownership";
import { PlaceEntity } from "../places/place.entity";
import { toPlaceDto } from "../places/places.service";
import { moscowDateKey } from "../time/moscow-date";
import { PlaceExtraEntity, SlotChatMessageEntity, SlotWaitlistEntity } from "./slot-extra.entity";
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
    @InjectRepository(PlaceExtraEntity) private readonly extras: Repository<PlaceExtraEntity>,
    @InjectRepository(SlotWaitlistEntity) private readonly waitlist: Repository<SlotWaitlistEntity>,
    @InjectRepository(SlotChatMessageEntity) private readonly chat: Repository<SlotChatMessageEntity>,
  ) {}

  async board(placeId: string, viewerId: string, date?: string, now = new Date()) {
    const place = await this.requirePlace(placeId);
    await this.ensureWeek(place.id, now);
    await this.ensureExtras(place.id);
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
      extras: (await this.extras.find({ where: { placeId: place.id } })).map((row) => ({ id: row.id, title: row.title, priceRub: row.priceRub })),
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
    return rows
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .slice(0, limit)
      .map(toPlaceSlot);
  }

  async book(userId: string, slotId: string, companionIds: string[] = [], extraIds: string[] = []) {
    const companions = companionIds.filter((id) => IdSchema.safeParse(id).success);
    const extras = extraIds.filter((id) => IdSchema.safeParse(id).success);
    const slot = await this.slots.findOneBy({ id: slotId });
    if (!slot) throw new NotFoundException("Slot not found");
    await this.requirePlace(slot.placeId);
    await this.ensureExtras(slot.placeId);
    const catalog = await this.extras.find({ where: { placeId: slot.placeId } });
    const chosen = catalog.filter((row) => extras.includes(row.id));
    const extrasTotal = chosen.reduce((sum, row) => sum + row.priceRub, 0);
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
          extraIds: chosen.map((row) => row.id),
          totalRub: (slot.priceRub ?? 0) + extrasTotal,
          cancelBefore: slot.startsAt,
        }),
      );
      return toSlotBooking(saved);
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
      booking: toSlotBooking(booking),
      slot: toPlaceSlot(slot),
      place: toPlaceDto(place),
      unitTitle: slot.unitTitle,
      company: friends.slice(0, Math.max(0, booking.partySize - 1)),
      freeSeats: Math.max(0, slot.capacity - slot.takenSeats),
      distanceKm: null,
      travelMinutes: null,
      chat: (await this.chat.find({ where: { bookingId: booking.id } })).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)).map((row) => ({ id: row.id, userId: row.userId, text: row.text, createdAt: row.createdAt.toISOString() })),
    };
  }

  async cancel(userId: string, bookingId: string) {
    const booking = await this.bookings.findOneBy({ id: bookingId });
    if (!booking) throw new NotFoundException("Booking not found");
    if (booking.userId !== userId) throw new ForbiddenException("Cannot cancel another user's booking");
    const slot = await this.slots.findOneBy({ id: booking.slotId });
    if (!slot) throw new NotFoundException("Slot not found");
    await this.requirePlace(slot.placeId);
    if (booking.status === "cancelled") return toSlotBooking(booking);
    booking.status = "cancelled";
    slot.takenSeats = Math.max(0, slot.takenSeats - booking.partySize);
    await this.slots.save(slot);
    await this.bookings.save(booking);
    return toSlotBooking(booking);
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
        return [{ booking: toSlotBooking(row), slot: toPlaceSlot(slot), place: toPlaceDto(place), unitTitle: slot.unitTitle, activity: place.category, company: [] }];
      });
    const waiting = await this.waitlist.find({ where: { userId } });
    const waitSlots = waiting.length === 0 ? [] : await this.slots.find({ where: { id: In(waiting.map((row) => row.slotId)) } });
    const waitSlotById = new Map(waitSlots.map((row) => [row.id, row]));
    const queues = new Map<string, SlotWaitlistEntity[]>();
    for (const row of waiting) {
      if (!queues.has(row.slotId)) queues.set(row.slotId, await this.waitlist.find({ where: { slotId: row.slotId } }));
    }
    const waitlist = waiting.flatMap((row) => {
      const slot = waitSlotById.get(row.slotId);
      const place = slot ? placeById.get(slot.placeId) : undefined;
      if (!slot || !place) return [];
      const ahead = (queues.get(row.slotId) ?? []).filter((other) => other.createdAt.getTime() < row.createdAt.getTime()).length;
      return [{ entry: { id: row.id, slotId: row.slotId, placeId: row.placeId, userId: row.userId, position: ahead + 1, seats: row.seats }, slot: toPlaceSlot(slot), place: toPlaceDto(place), unitTitle: slot.unitTitle, activity: place.category }];
    });
    return { bookings, waitlist };
  }

  async joinWaitlist(userId: string, slotId: string, seats = 1) {
    const slot = await this.slots.findOneBy({ id: slotId });
    if (!slot) throw new NotFoundException("Slot not found");
    await this.requirePlace(slot.placeId);
    if (slot.takenSeats < slot.capacity) throw new ConflictException("Seats are still free");
    const existing = await this.waitlist.findOneBy({ slotId, userId });
    if (existing) return existing;
    return this.waitlist.save(this.waitlist.create({ slotId, placeId: slot.placeId, userId, seats: Math.max(1, seats) }));
  }

  async leaveWaitlist(userId: string, entryId: string) {
    const row = await this.waitlist.findOneBy({ id: entryId });
    if (!row || row.userId !== userId) throw new NotFoundException("Waitlist entry not found");
    const copy = { id: row.id, slotId: row.slotId, placeId: row.placeId, userId: row.userId, seats: row.seats };
    await this.waitlist.delete({ id: row.id });
    return { id: copy.id, slotId: copy.slotId, placeId: copy.placeId, userId: copy.userId, position: 0, seats: copy.seats };
  }

  async listChat(userId: string, bookingId: string) {
    const booking = await this.bookings.findOneBy({ id: bookingId });
    if (!booking || booking.userId !== userId) throw new NotFoundException("Booking not found");
    const rows = await this.chat.find({ where: { bookingId } });
    return rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)).map((row) => ({ id: row.id, userId: row.userId, text: row.text, createdAt: row.createdAt.toISOString() }));
  }

  async addChat(userId: string, bookingId: string, text: string) {
    const booking = await this.bookings.findOneBy({ id: bookingId });
    if (!booking || booking.userId !== userId) throw new NotFoundException("Booking not found");
    const trimmed = text.trim();
    if (trimmed.length === 0 || trimmed.length > 2000) throw new BadRequestException("Invalid chat payload");
    const saved = await this.chat.save(this.chat.create({ bookingId, userId, text: trimmed }));
    return { id: saved.id, userId: saved.userId, text: saved.text, createdAt: saved.createdAt.toISOString() };
  }

  async updateSlot(actorId: string, placeId: string, slotId: string, patch: { capacity?: number; priceRub?: number | null; unitTitle?: string }) {
    const place = await this.requirePlace(placeId);
    if (!isOrganizerOwner(place, actorId)) throw new ForbiddenException("Not the organizer");
    const slot = await this.slots.findOneBy({ id: slotId, placeId });
    if (!slot) throw new NotFoundException("Slot not found");
    if (patch.capacity !== undefined) {
      if (!Number.isInteger(patch.capacity) || patch.capacity < slot.takenSeats || patch.capacity < 1) throw new ConflictException("Invalid capacity");
      slot.capacity = patch.capacity;
    }
    if (patch.priceRub !== undefined) slot.priceRub = patch.priceRub;
    if (patch.unitTitle !== undefined && patch.unitTitle.trim() !== "") slot.unitTitle = patch.unitTitle.trim();
    await this.slots.save(slot);
    return toPlaceSlot(slot);
  }

  private async requirePlace(placeId: string): Promise<PlaceEntity> {
    const place = await this.places.findOneBy({ id: placeId });
    if (!place || place.published === false) throw new NotFoundException("Place not found");
    return place;
  }

  private async ensureExtras(placeId: string): Promise<void> {
    const existing = await this.extras.find({ where: { placeId } });
    if (existing.length > 0) return;
    await this.extras.save(this.extras.create({ placeId, title: "Уголь и шампуры", priceRub: 600 }));
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

function toSlotBooking(row: SlotBookingEntity) {
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
