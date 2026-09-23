// START_MODULE_CONTRACT
// PURPOSE: Mock store of the slot domain: the bookable units of the fixture venues, the windows they publish day by day, the bookings and waiting positions those windows produce, and the venue board of экран 34.
// SCOPE: Fixtures, in-memory state and pure helpers only; the route table lives in ./slots.routes.ts. Nothing here exists on the backend (#492) — the data is shaped after the endpoint signatures in ../endpoints/slots.ts, so wiring the real domain in is a deletion, not a rewrite.
// DEPENDS: @max-events/api-contracts, ./fixtures.js, ./bookings.js (check-ins and event bookings, read-only), ./catalog.js (participation counters, read-only), ../endpoints/slots.js
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MOCK_SILVER_FOREST - the Серебряный Бор venue of макет, экраны 19–21; a fixture of this domain, the catalog listing knows nothing about it
// - mockSlotUnits - the bookable units of the fixture venues: the barbecue zone of the park, the gazebo by the bay, the padel court
// - MOCK_SLOT_EXTRAS - the paid add-ons offered with a window («Уголь и шампуры»)
// - MOCK_SLOT_DAYS - how many days ahead a venue publishes windows for (the date strip of экран 19)
// - mockSlotBookings - in-memory slot bookings, seeded with the demo booking of экраны 20 и 21
// - mockSlotWaitlist - in-memory waiting positions, seeded with the padel court entry of экран 21
// - resetMockSlots - restore the seeded booking and waiting position (test isolation)
// - moscowDayKey - Moscow calendar day key (YYYY-MM-DD) of a date
// - slotId - deterministic slot id: unit, day and window index, so a window needs no storage to be resolved
// - parseSlotId - slot id -> unit index, day key and window index; null for anything else
// - mockSlotWeather - deterministic forecast of one day: the same day always answers the same way
// - slotsOfDay - the windows one unit publishes on one day, bookings and waiting positions applied
// - slotById - one window by its id, or null
// - mockSlotBoard - экран 19 payload: venue, unit, date strip, windows of the chosen day, add-ons and company
// - mockSlotBookingScreen - экран 20 payload: booking, window, venue, company, free seats, travel estimate, chat
// - createMockSlotBooking - book a window: "no_slot" for an unknown one, "taken" when it is not free any more
// - cancelMockSlotBooking - cancel own booking, null when there is no such one
// - mockMySlots - экран 21 payload of this domain: own bookings and own waiting positions
// - leaveMockSlotWaitlist - drop a waiting position, null when it is already gone
// - mockCheckInCodes - entry codes of the viewer's bookings: the slot ones plus the event ones (#492)
// - mockPlaceBoard - экран 34 payload: opening hours, today's check-in, occupancy, visit months, windows and what is coming
// END_MODULE_MAP

import type { Event, EventWeather, Friend, Place } from "@max-events/api-contracts";
import type { CreateSlotBooking, MySlotsBoard, PlaceBoard, PlaceSlot, PlaceUpcomingEvent, PlaceVisitMonth, SlotBoard, SlotBooking, SlotBookingScreen, SlotChatMessage, SlotDay, SlotExtra, SlotWaitlistEntry } from "../endpoints/slots";
import { mockBookings, mockCheckIns } from "./bookings";
import { participationStats } from "./catalog";
import { PLACE_STAMP, haversineKm, mockDemoUser, mockEvents, mockFriends, mockPlaces, place } from "./fixtures";

/**
 * Серебряный Бор — the venue макет, экраны 19–21 rent a gazebo at. It is a fixture of this domain
 * rather than of ./fixtures.ts: the catalog listing must keep answering exactly the five seeded
 * places, and a venue that only rents windows is invisible to it until the slot domain is real.
 */
export const MOCK_SILVER_FOREST: Place = place({ id: "b0000006-0000-4000-8000-000000000006", title: "Серебряный Бор", address: "Таманская улица, 91", city: "Москва", category: "park", latitude: 55.7787, longitude: 37.4278 });

interface MockSlotUnit {
  place: Place;
  /** The bookable unit inside the venue: what экран 19 puts in its title. */
  title: string;
  /** What the unit is booked for — the headline of a card on экран 21, where the unit itself is the line above it. */
  activity: string;
  pricePerHourRub: number;
  capacity: number;
  amenities: string[];
  /** Windows as [startHour, startMinute, endHour, endMinute], in the order the venue publishes them. */
  windows: [number, number, number, number][];
  /** Weekdays (0 = Sunday) the unit is rented on; undefined means every day. */
  weekdays?: number[];
  /** Index of the window the venue keeps for itself, so a «Занято» row exists without anyone booking it. */
  reservedWindow?: number;
}

/**
 * The bookable units of the demo. A slot is a place plus a window plus a capacity plus a price, so a
 * unit is only the thing that repeats: the same windows, day after day, at the same hourly rate.
 */
export const mockSlotUnits: MockSlotUnit[] = [
  {
    place: mockPlaces[0],
    title: "Мангальная зона у пруда",
    activity: "Мангал у пруда",
    pricePerHourRub: 800,
    capacity: 12,
    amenities: ["мангал и решётки", "навес от дождя", "розетка 220 В", "стол на 12 человек"],
    windows: [
      [14, 0, 17, 0],
      [17, 30, 20, 30],
      [21, 0, 23, 30],
    ],
  },
  {
    place: MOCK_SILVER_FOREST,
    title: "Беседка №4 у залива",
    activity: "Мангал у залива",
    pricePerHourRub: 800,
    capacity: 12,
    amenities: ["мангал и решётки", "навес от дождя", "розетка 220 В", "стол на 12 человек"],
    windows: [
      [11, 0, 13, 30],
      [14, 0, 17, 0],
      [17, 30, 20, 30],
      [21, 0, 23, 30],
    ],
    reservedWindow: 0,
  },
  {
    place: mockPlaces[2],
    title: "Корт №3",
    activity: "Падел по четвергам",
    pricePerHourRub: 800,
    capacity: 4,
    amenities: ["ракетки напрокат", "душевые", "освещение"],
    windows: [[19, 30, 21, 0]],
    weekdays: [4],
    // Единственное окно корта занято — иначе позиция в листе ожидания (экран 21) висела бы на свободном окне
    reservedWindow: 0,
  },
];

export const MOCK_SLOT_EXTRAS: SlotExtra[] = [{ id: "coal", title: "Уголь и шампуры", priceRub: 600 }];

/** Seven days: the strip of экран 19 shows a week, the tail of it dimmed because nothing is published yet. */
export const MOCK_SLOT_DAYS = 7;

/** Beyond this many days ahead a venue has not opened its calendar, so every window reads as taken. */
const PUBLISHED_DAYS = 4;

const MSK_OFFSET = "+03:00";

const DAY_MS = 24 * 60 * 60 * 1000;

export function moscowDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/**
 * The id carries the unit, the day and the window, so a window is resolvable without a table: the
 * mock publishes a rolling week and stores only what somebody booked. A real backend keeps rows and
 * ids of its own — nothing outside this module reads the parts back apart from parseSlotId.
 */
export function slotId(unitIndex: number, day: string, windowIndex: number): string {
  return `f000000${unitIndex}-0000-4000-8000-${day.replace(/-/g, "")}${String(windowIndex).padStart(4, "0")}`;
}

export function parseSlotId(id: string): { unitIndex: number; day: string; windowIndex: number } | null {
  const match = /^f000000(\d)-0000-4000-8000-(\d{4})(\d{2})(\d{2})(\d{4})$/.exec(id);
  if (match === null) return null;
  const unitIndex = Number(match[1]);
  if (mockSlotUnits[unitIndex] === undefined) return null;
  const windowIndex = Number(match[5]);
  if (mockSlotUnits[unitIndex].windows[windowIndex] === undefined) return null;
  return { unitIndex, day: `${match[2]}-${match[3]}-${match[4]}`, windowIndex };
}

const WEATHER_TABLE: Omit<EventWeather, "temperatureC">[] = [
  { condition: "ясно", conditionCode: 0, precipitationProbability: 5 },
  { condition: "переменная облачность", conditionCode: 2, precipitationProbability: 20 },
  { condition: "облачно", conditionCode: 3, precipitationProbability: 35 },
  { condition: "дождь", conditionCode: 61, precipitationProbability: 70 },
];

/** Day key -> a stable number; the same day must always answer the same forecast, mock or not. */
function daySeed(day: string): number {
  let seed = 0;
  for (const char of day) seed = (seed * 31 + char.charCodeAt(0)) % 9973;
  return seed;
}

/** Deterministic forecast of one day: +14…+23 °C, the four conditions of the design in rotation (#495). */
export function mockSlotWeather(day: string, hourShift = 0): EventWeather {
  const seed = daySeed(day) + hourShift;
  return { temperatureC: 14 + (seed % 10), ...WEATHER_TABLE[seed % WEATHER_TABLE.length] };
}

function windowAt(day: string, [hour, minute]: [number, number]): string {
  return `${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00${MSK_OFFSET}`;
}

/** Same rounding the design prints: 800 ₽/час over 2,5 часа is 2 000 ₽, not 2 000,000 kopecks of float. */
function windowPrice(unit: MockSlotUnit, minutes: number): number {
  return Math.round((unit.pricePerHourRub * minutes) / 60);
}

export const mockSlotBookings: SlotBooking[] = [];

export const mockSlotWaitlist: SlotWaitlistEntry[] = [];

const mockSlotChat: SlotChatMessage[] = [];

/** «MAX-4821-19SB»: the shape of the code the design shows at the entrance; derived from the booking so it is stable. */
function checkInCodeFor(seed: string, day: string): string {
  let number = 0;
  for (const char of seed) number = (number * 33 + char.charCodeAt(0)) % 10000;
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const suffix = `${letters[number % letters.length]}${letters[(number * 7) % letters.length]}`;
  return `MAX-${String(number).padStart(4, "0")}-${day.slice(8)}${suffix}`;
}

function nextDayOfWeek(from: Date, weekday: number): Date {
  const date = new Date(from.getTime());
  while (date.getDay() !== weekday) date.setTime(date.getTime() + DAY_MS);
  return date;
}

/**
 * Module-load seed: the booking of макет, экран 20 (the gazebo, tomorrow evening, a company of
 * three) and the waiting position of экран 21 (the padel court on the nearest Thursday). Both hang
 * off the wall clock so the demo never shows a booking in the past; test resets restore them.
 */
function seedMockSlots(now = new Date()): void {
  const tomorrow = moscowDayKey(new Date(now.getTime() + DAY_MS));
  const bookedSlot = slotId(1, tomorrow, 2);
  const unit = mockSlotUnits[1];
  const minutes = 3 * 60;
  const id = "f1000000-0000-4000-8000-000000000001";
  mockSlotBookings.push({
    id,
    slotId: bookedSlot,
    placeId: unit.place.id,
    userId: mockDemoUser.id,
    status: "active",
    checkInCode: checkInCodeFor(bookedSlot, tomorrow),
    partySize: 3,
    extraIds: [MOCK_SLOT_EXTRAS[0].id],
    totalRub: windowPrice(unit, minutes) + MOCK_SLOT_EXTRAS[0].priceRub,
    cancelBefore: `${tomorrow}T12:00:00${MSK_OFFSET}`,
    createdAt: PLACE_STAMP,
    updatedAt: PLACE_STAMP,
  });
  mockSlotChat.push({ id: "f1000000-0000-4000-8000-000000000011", bookingId: id, authorKind: "venue", authorName: "Серебряный Бор", text: "Беседка будет открыта с 17:20, уголь оставим у входа", sentAt: `${moscowDayKey(now)}T10:12:00${MSK_OFFSET}` });
  const thursday = moscowDayKey(nextDayOfWeek(new Date(now.getTime() + DAY_MS), 4));
  mockSlotWaitlist.push({ id: "f2000000-0000-4000-8000-000000000001", slotId: slotId(2, thursday, 0), placeId: mockSlotUnits[2].place.id, userId: mockDemoUser.id, position: 2, seats: 2 });
}

seedMockSlots();

export function resetMockSlots(): void {
  mockSlotBookings.length = 0;
  mockSlotWaitlist.length = 0;
  mockSlotChat.length = 0;
  seedMockSlots();
}

function unitIndexOfPlace(placeId: string): number {
  return mockSlotUnits.findIndex((unit) => unit.place.id === placeId);
}

function publishes(unit: MockSlotUnit, day: string): boolean {
  if (unit.weekdays === undefined) return true;
  return unit.weekdays.includes(new Date(`${day}T12:00:00${MSK_OFFSET}`).getDay());
}

/** One window as the unit's schedule describes it, with whatever the store did to it applied on top. */
function slotShape(unit: MockSlotUnit, unitIndex: number, day: string, windowIndex: number): PlaceSlot {
  const window = unit.windows[windowIndex];
  const id = slotId(unitIndex, day, windowIndex);
  const startsAt = windowAt(day, [window[0], window[1]]);
  const endsAt = windowAt(day, [window[2], window[3]]);
  const minutes = (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000;
  const booking = mockSlotBookings.find((item) => item.slotId === id && item.status === "active");
  const reserved = unit.reservedWindow === windowIndex;
  const status: PlaceSlot["status"] = booking !== undefined || reserved ? "booked" : "free";
  return {
    id,
    placeId: unit.place.id,
    startsAt,
    endsAt,
    capacity: unit.capacity,
    takenSeats: booking?.partySize ?? (reserved ? unit.capacity : 0),
    priceRub: windowPrice(unit, minutes),
    status,
    busyUntil: status === "booked" ? endsAt : null,
    weather: mockSlotWeather(day, windowIndex),
  };
}

function daysAhead(day: string, now: Date): number {
  return (new Date(`${day}T00:00:00${MSK_OFFSET}`).getTime() - new Date(`${moscowDayKey(now)}T00:00:00${MSK_OFFSET}`).getTime()) / DAY_MS;
}

/** The windows of one unit on one day: the published shape first, then whatever the store did to it. */
export function slotsOfDay(unitIndex: number, day: string, now = new Date()): PlaceSlot[] {
  const unit = mockSlotUnits[unitIndex];
  if (unit === undefined || !publishes(unit, day)) return [];
  // Past the published horizon the venue has simply not opened its calendar: the day exists in the
  // strip (dimmed) but carries no windows at all, which is not the same as every window being taken.
  const ahead = daysAhead(day, now);
  if (ahead < 0 || ahead >= PUBLISHED_DAYS) return [];
  return unit.windows.map((_window, index) => slotShape(unit, unitIndex, day, index));
}

/**
 * One window by its id. `beyondHorizon` is what a waiting position needs: you queue for a window
 * precisely because the venue has not put it up for booking yet, so the entry itself is the proof the
 * window exists and the horizon must not hide it. Booking keeps the horizon — nothing unopened is sold.
 */
export function slotById(id: string, now = new Date(), { beyondHorizon = false }: { beyondHorizon?: boolean } = {}): PlaceSlot | null {
  const parsed = parseSlotId(id);
  if (parsed === null) return null;
  const unit = mockSlotUnits[parsed.unitIndex];
  if (!publishes(unit, parsed.day) || daysAhead(parsed.day, now) < 0) return null;
  if (beyondHorizon) return slotShape(unit, parsed.unitIndex, parsed.day, parsed.windowIndex);
  return slotsOfDay(parsed.unitIndex, parsed.day, now)[parsed.windowIndex] ?? null;
}

function slotDays(unitIndex: number, now: Date): SlotDay[] {
  const days: SlotDay[] = [];
  for (let offset = 0; offset < MOCK_SLOT_DAYS; offset += 1) {
    const day = moscowDayKey(new Date(now.getTime() + offset * DAY_MS));
    days.push({ date: day, weather: mockSlotWeather(day), hasFreeSlots: slotsOfDay(unitIndex, day, now).some((slot) => slot.status === "free") });
  }
  return days;
}

/** Экран 19 payload; null for a venue that rents nothing, which is a 404 rather than an empty board. */
export function mockSlotBoard(placeId: string, date: string | null, now = new Date()): SlotBoard | null {
  const unitIndex = unitIndexOfPlace(placeId);
  if (unitIndex === -1) return null;
  const unit = mockSlotUnits[unitIndex];
  const days = slotDays(unitIndex, now);
  const day = date ?? days.find((item) => item.hasFreeSlots)?.date ?? days[0].date;
  return {
    place: unit.place,
    unitTitle: unit.title,
    pricePerHourRub: unit.pricePerHourRub,
    cancelBefore: `${day}T12:00:00${MSK_OFFSET}`,
    amenities: unit.amenities,
    extras: MOCK_SLOT_EXTRAS,
    days,
    date: day,
    slots: slotsOfDay(unitIndex, day, now),
    company: mockFriends.slice(0, 2),
    candidates: mockFriends.slice(2, 5),
  };
}

function companyOf(booking: SlotBooking): Friend[] {
  return mockFriends.slice(0, Math.max(0, booking.partySize - 1));
}

/**
 * Rough «2,4 км · 15 мин»: the distance is real, the minutes are the city average this stands in for
 * until a routing service answers (#504). Six minutes of getting there and back out plus 16 km/h —
 * a flat rate per kilometre would read the short hop of the design right and turn a cross-town trip
 * into an hour and a quarter.
 */
function travelTo(place: Place): { distanceKm: number; travelMinutes: number } {
  const distanceKm = Math.round(haversineKm(mockPlaces[0].latitude, mockPlaces[0].longitude, place.latitude, place.longitude) * 10) / 10;
  return { distanceKm, travelMinutes: Math.max(5, Math.round(6 + (distanceKm * 60) / 16)) };
}

export function mockSlotBookingScreen(bookingId: string, now = new Date()): SlotBookingScreen | null {
  const booking = mockSlotBookings.find((item) => item.id === bookingId);
  if (booking === undefined) return null;
  const slot = slotById(booking.slotId, now);
  const unitIndex = unitIndexOfPlace(booking.placeId);
  if (slot === null || unitIndex === -1) return null;
  const unit = mockSlotUnits[unitIndex];
  const travel = travelTo(unit.place);
  return {
    booking,
    slot,
    place: unit.place,
    unitTitle: unit.title,
    company: companyOf(booking),
    freeSeats: Math.max(0, unit.capacity - booking.partySize),
    distanceKm: travel.distanceKm,
    travelMinutes: travel.travelMinutes,
    chat: mockSlotChat.filter((message) => message.bookingId === booking.id),
  };
}

export function createMockSlotBooking(payload: CreateSlotBooking, now = new Date()): SlotBooking | "no_slot" | "taken" {
  const parsed = parseSlotId(payload.slotId);
  if (parsed === null) return "no_slot";
  const slot = slotById(payload.slotId, now);
  if (slot === null) return "no_slot";
  if (slot.status !== "free") return "taken";
  const unit = mockSlotUnits[parsed.unitIndex];
  const extras = MOCK_SLOT_EXTRAS.filter((extra) => payload.extraIds.includes(extra.id));
  const booking: SlotBooking = {
    id: `f1000000-0000-4000-8000-${String(mockSlotBookings.length + 2).padStart(12, "0")}`,
    slotId: payload.slotId,
    placeId: unit.place.id,
    userId: payload.userId,
    status: "active",
    checkInCode: checkInCodeFor(payload.slotId, parsed.day),
    partySize: payload.companionIds.length + 1,
    extraIds: extras.map((extra) => extra.id),
    totalRub: (slot.priceRub ?? 0) + extras.reduce((sum, extra) => sum + extra.priceRub, 0),
    cancelBefore: `${parsed.day}T12:00:00${MSK_OFFSET}`,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  mockSlotBookings.push(booking);
  return booking;
}

export function cancelMockSlotBooking(bookingId: string, now = new Date()): SlotBooking | null {
  const booking = mockSlotBookings.find((item) => item.id === bookingId);
  if (booking === undefined) return null;
  booking.status = "cancelled";
  booking.updatedAt = now.toISOString();
  return booking;
}

export function mockMySlots(userId: string, now = new Date()): MySlotsBoard {
  const bookings = mockSlotBookings
    .filter((booking) => booking.userId === userId && booking.status === "active")
    .flatMap((booking) => {
      const unitIndex = unitIndexOfPlace(booking.placeId);
      const slot = slotById(booking.slotId, now);
      if (unitIndex === -1 || slot === null) return [];
      return [{ booking, slot, place: mockSlotUnits[unitIndex].place, unitTitle: mockSlotUnits[unitIndex].title, activity: mockSlotUnits[unitIndex].activity, company: companyOf(booking) }];
    });
  const waitlist = mockSlotWaitlist
    .filter((entry) => entry.userId === userId)
    .flatMap((entry) => {
      const unitIndex = unitIndexOfPlace(entry.placeId);
      const slot = slotById(entry.slotId, now, { beyondHorizon: true });
      if (unitIndex === -1 || slot === null) return [];
      return [{ entry, slot, place: mockSlotUnits[unitIndex].place, unitTitle: mockSlotUnits[unitIndex].title, activity: mockSlotUnits[unitIndex].activity }];
    });
  return { bookings, waitlist };
}

export function leaveMockSlotWaitlist(entryId: string): SlotWaitlistEntry | null {
  const index = mockSlotWaitlist.findIndex((entry) => entry.id === entryId);
  if (index === -1) return null;
  return mockSlotWaitlist.splice(index, 1)[0];
}

/** Codes of everything the viewer holds: slot bookings carry their own, event bookings get one derived from their id (#492). */
export function mockCheckInCodes(userId: string): { bookingId: string; code: string }[] {
  const slots = mockSlotBookings.filter((booking) => booking.userId === userId && booking.status === "active").map((booking) => ({ bookingId: booking.id, code: booking.checkInCode }));
  const tickets = mockBookings.filter((booking) => booking.userId === userId && booking.status === "active").map((booking) => ({ bookingId: booking.id, code: checkInCodeFor(booking.id, moscowDayKey(new Date(booking.createdAt))) }));
  return [...slots, ...tickets];
}

/** Closing hours per venue kind: a Place carries no schedule at all, so the board answers this line instead. */
const OPEN_UNTIL: Record<string, string> = { park: "23:00", museum: "20:00", food: "23:00", sport: "22:00", other: "21:00" };

/**
 * Average load per hour of the open day, 10:00..22:00 — the curve of «Когда людно»; venue analytics
 * do not exist. Thirteen points, one per hour, because the axis of the design reads 10 … 22 and the
 * «Сейчас» marker has to find the current hour in here on an evening too.
 */
const OCCUPANCY_CURVE: number[] = [0.2, 0.25, 0.35, 0.5, 0.45, 0.4, 0.55, 0.7, 0.85, 1, 0.9, 0.6, 0.3];

const OCCUPANCY_FIRST_HOUR = 10;

function visitMonthsOf(userId: string, placeId: string): { months: PlaceVisitMonth[]; more: number } {
  const counts = new Map<string, number>();
  const eventIds = new Set(mockEvents.filter((event) => event.placeId === placeId).map((event) => event.id));
  for (const checkIn of mockCheckIns) {
    if (checkIn.userId !== userId) continue;
    if (checkIn.placeId !== placeId && (checkIn.eventId === null || !eventIds.has(checkIn.eventId))) continue;
    const month = checkIn.checkedInAt.slice(0, 7);
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  const months = [...counts.entries()].map(([month, visitsCount]) => ({ month, visitsCount })).sort((a, b) => a.month.localeCompare(b.month));
  // The grid draws three cells and a counter: the newest three months, everything older behind «+N».
  const shown = months.slice(-3);
  return { months: shown, more: months.slice(0, Math.max(0, months.length - 3)).reduce((sum, item) => sum + item.visitsCount, 0) };
}

function upcomingAt(placeId: string, userId: string, now: Date): PlaceUpcomingEvent[] {
  return mockEvents
    .filter((event) => event.placeId === placeId && event.published !== false && new Date(event.startsAt).getTime() >= now.getTime())
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt))
    .slice(0, 3)
    .map((event: Event) => {
      const stats = participationStats(event.id, userId);
      const goingCount = stats.counts.going + stats.counts.wants_to_go + mockBookings.filter((booking) => booking.eventId === event.id && booking.status === "active").length;
      return { event, friends: mockFriends.slice(0, Math.min(2, stats.friendsCount)), friendsCount: stats.friendsCount, goingCount, joined: stats.myStatus !== null || mockBookings.some((booking) => booking.eventId === event.id && booking.userId === userId && booking.status === "active") };
    });
}

/** Экран 34 payload; null for an unknown venue, so the screen 404s like the place page does. */
export function mockPlaceBoard(placeId: string, userId: string, now = new Date()): PlaceBoard | null {
  const venue = mockPlaces.find((item) => item.id === placeId) ?? (MOCK_SILVER_FOREST.id === placeId ? MOCK_SILVER_FOREST : undefined);
  if (venue === undefined) return null;
  const today = moscowDayKey(now);
  const unitIndex = unitIndexOfPlace(placeId);
  const unit = unitIndex === -1 ? null : mockSlotUnits[unitIndex];
  const weekEnd = now.getTime() + 7 * DAY_MS;
  const history = visitMonthsOf(userId, placeId);
  const slots = unit === null ? [] : slotDays(unitIndex, now).flatMap((day) => slotsOfDay(unitIndex, day.date, now).filter((slot) => slot.status === "free"));
  return {
    placeId,
    openUntil: OPEN_UNTIL[venue.category] ?? null,
    checkedInToday: mockCheckIns.some((checkIn) => checkIn.userId === userId && checkIn.placeId === placeId && checkIn.checkedInAt.slice(0, 10) === today),
    weekEventsCount: mockEvents.filter((event) => event.placeId === placeId && new Date(event.startsAt).getTime() >= now.getTime() && new Date(event.startsAt).getTime() <= weekEnd).length,
    occupancy: OCCUPANCY_CURVE.map((load, index) => ({ hour: OCCUPANCY_FIRST_HOUR + index, load })),
    occupancyNowHour: Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Moscow", hour: "2-digit", hour12: false }).format(now)),
    visitMonths: history.months,
    visitMonthsMore: history.more,
    unitTitle: unit?.title ?? null,
    pricePerHourRub: unit?.pricePerHourRub ?? null,
    cancelBefore: unit === null ? null : `${today}T12:00:00${MSK_OFFSET}`,
    slots: slots.slice(0, 3),
    upcoming: upcomingAt(placeId, userId, now),
  };
}
