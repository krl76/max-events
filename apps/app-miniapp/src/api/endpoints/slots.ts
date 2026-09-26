// START_MODULE_CONTRACT
// PURPOSE: Slot endpoints of the api client: the bookable windows of a venue (макет, экраны 34 и 19), the booking they produce with its entry code and chat (экран 20) and the viewer's own slot bookings and waiting positions (экран 21).
// SCOPE: GET /slots, POST/GET/DELETE /slots/bookings[/:id], GET /slots/my, POST/DELETE /slots/waitlist, GET /check-in-codes. Live backend: place_slots, extras, waitlist and chat.
// DEPENDS: ./transport.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - SlotStatus - availability of one window: free / held (someone is paying) / booked
// - SLOT_STATUSES - the statuses in design order, so a screen cannot invent a fourth
// - PlaceSlot - one bookable window: place + time window + capacity + price (#492)
// - SlotDay - one cell of the date strip of экран 19: day key, its forecast and whether anything is free that day (#495)
// - SlotExtra - a paid add-on of a booking («Уголь и шампуры, +600 ₽»)
// - SlotBoard - экран 19 aggregate: the venue, its bookable unit, the date strip, the windows of the chosen day, what is included, the add-ons and the company
// - CreateSlotBooking - slot booking payload (slot + companions + add-ons)
// - SlotBooking - the booking itself: entry code, party size, add-ons, total and the free-cancellation deadline
// - SlotChatMessage - one line of the booking chat (макет, экран 20); no chat domain exists
// - SlotBookingScreen - экран 20 aggregate: booking, window, venue, company, free seats, travel estimate and the chat
// - PlaceOccupancyHour - one bar of «Когда людно»: the hour and how full the venue is, 0..1
// - PlaceVisitMonth - one cell of «Твоя история здесь»: month key and visits in it
// - PlaceUpcomingEvent - one card of «Здесь скоро»: the event, the friends going, the counter and whether the viewer is in
// - PlaceBoard - экран 34 aggregate: everything the venue screen needs beyond PlacePage (opening hours, today's check-in, occupancy, personal history, slots, what is coming)
// - SlotWaitlistEntry - a waiting position on a window that is already taken (макет, экран 21)
// - MySlotBookingCard - экран 21 card: booking + window + venue + company
// - MySlotWaitlistCard - экран 21 card: waiting position + window + venue
// - MySlotsBoard - экран 21 aggregate of the slot domain: own bookings and own waiting positions
// - CheckInCode - entry code of one booking; neither a slot nor an event booking carries such a field today (#492)
// - withSlots - ApiClient.getPlaceBoard / getSlotBoard / createSlotBooking / getSlotBooking / cancelSlotBooking / listMySlots / leaveSlotWaitlist / listCheckInCodes
// END_MODULE_MAP

import { EventSchema, EventWeatherSchema, FriendSchema, PlaceSchema } from "@max-events/api-contracts";
import type { Event, EventWeather, Friend, Place } from "@max-events/api-contracts";
import type { ApiMixin, ZodSchema } from "./transport";

/**
 * Availability of one window. «held» is the state a window enters between «забронировать» and the
 * payment at the venue: it is not free any more, but it is not somebody's booking yet either.
 */
export type SlotStatus = "free" | "held" | "booked";

export const SLOT_STATUSES: readonly SlotStatus[] = ["free", "held", "booked"];

/**
 * One bookable window of a venue. This is the shape the slot endpoint will answer, and the reason
 * the four fields are together: a slot is a place plus a time window plus a capacity plus a price.
 * Live GET /slots answers this shape.
 */
export interface PlaceSlot {
  id: string;
  placeId: string;
  startsAt: string;
  endsAt: string;
  /** How many people the window holds («стол на 12 человек»). */
  capacity: number;
  /** Seats already taken by the company that holds the window; equals capacity for a full one. */
  takenSeats: number;
  /** Price of the whole window, ₽; null for a venue that takes no money for it. */
  priceRub: number | null;
  status: SlotStatus;
  /** «занято до 13:30» — when the current holder leaves; null unless the window is taken. */
  busyUntil: string | null;
  /** Forecast for the start of the window; null until a per-slot forecast exists (#495). */
  weather: EventWeather | null;
}

/** One cell of the date strip: a day the venue publishes windows for, its forecast and whether anything is still free. */
export interface SlotDay {
  /** Moscow calendar day key, YYYY-MM-DD. */
  date: string;
  weather: EventWeather | null;
  /** A day without free windows is drawn dimmed instead of being hidden — the strip must not jump. */
  hasFreeSlots: boolean;
}

/** A paid add-on offered with the window: «Уголь и шампуры, +600 ₽ к брони». */
export interface SlotExtra {
  id: string;
  title: string;
  priceRub: number;
}

/** Экран 19 in one response: the venue, its bookable unit, the date strip, the windows of one day, what the rent includes, the add-ons and who is coming. */
export interface SlotBoard {
  place: Place;
  /** The bookable unit inside the venue: «Беседка №4 у залива». */
  unitTitle: string;
  /** Published hourly rate, ₽; null when the unit is free. */
  pricePerHourRub: number | null;
  /** Free cancellation deadline of the chosen day, ISO; null when the venue promises none. */
  cancelBefore: string | null;
  /** What the rent already includes: «мангал и решётки», «навес от дождя». */
  amenities: string[];
  extras: SlotExtra[];
  days: SlotDay[];
  /** The day the windows below belong to: the one that was asked for, or the first one with something free. */
  date: string;
  /** Windows of that day, earliest first. */
  slots: PlaceSlot[];
  /** Who the viewer usually goes with — the company the bill is split between until they change it. */
  company: Friend[];
  /** Friends «Добавить» can add to the company. */
  candidates: Friend[];
}

/** Slot booking payload; the userId field is a mock-only convenience ignored by the real backend (identity comes from the init-data token). */
export interface CreateSlotBooking {
  slotId: string;
  userId: string;
  /** Friends sharing the window; the bill is split between them and the viewer. */
  companionIds: string[];
  extraIds: string[];
}

/** A booked window: what экран 20 confirms and экран 21 lists. */
export interface SlotBooking {
  id: string;
  slotId: string;
  placeId: string;
  userId: string;
  status: "active" | "cancelled";
  /** «MAX-4821-19SB» — what is shown at the entrance (#492). */
  checkInCode: string;
  /** People in the company, the viewer included; the bill is split by this number. */
  partySize: number;
  extraIds: string[];
  /** What the venue is owed for the window and the add-ons, ₽. */
  totalRub: number;
  /** Free cancellation deadline, ISO; null when the venue promises none. */
  cancelBefore: string | null;
  createdAt: string;
  updatedAt: string;
}

/** One line of the booking chat (макет, экран 20). There is no chat domain at all, so this is the shape that endpoint will answer. */
export interface SlotChatMessage {
  id: string;
  bookingId: string;
  /** Who is speaking: the venue itself or a member of the company. */
  authorKind: "venue" | "member";
  /** Display name; «ПГ» initials of a venue, a first name for a member. */
  authorName: string;
  text: string;
  sentAt: string;
}

/** Экран 20 in one response. */
export interface SlotBookingScreen {
  booking: SlotBooking;
  slot: PlaceSlot;
  place: Place;
  unitTitle: string;
  /** The company, the viewer excluded (they are the owner of the booking). */
  company: Friend[];
  /** Seats still free at the table: capacity minus the party. */
  freeSeats: number;
  /** «2,4 км» to the venue; null until routing answers a distance for the viewer (#504). */
  distanceKm: number | null;
  /** «15 мин» on the way; null together with distanceKm (#504). */
  travelMinutes: number | null;
  chat: SlotChatMessage[];
}

/** One bar of «Когда людно»: the hour and how full the venue is then. */
export interface PlaceOccupancyHour {
  /** Moscow hour, 0..23. */
  hour: number;
  /** 0..1; the bar height, not a headcount — the venue capacity is not public. */
  load: number;
}

/** One cell of «Твоя история здесь»: a month the viewer was here and how many times. */
export interface PlaceVisitMonth {
  /** YYYY-MM. */
  month: string;
  visitsCount: number;
}

/** One card of «Здесь скоро». */
export interface PlaceUpcomingEvent {
  event: Event;
  /** Friends going, in the order the line names them; the counter below may be larger. */
  friends: Friend[];
  friendsCount: number;
  /** How many people are going: «11 из 40» together with event.capacity. */
  goingCount: number;
  joined: boolean;
}

/**
 * Экран 34 beyond PlacePage. The social blocks (friends, rating, personal visits) already have an
 * endpoint; everything here does not: opening hours are not a Place field, the daily check-in state
 * is not returned anywhere, and occupancy, the visit grid and the bookable windows have no domain.
 */
export interface PlaceBoard {
  placeId: string;
  /** «до 23:00» — closing time of today; null when the venue publishes no hours. */
  openUntil: string | null;
  /** A place may be checked into once a day; the aggregate says whether today is spent. */
  checkedInToday: boolean;
  /** Events at the venue over the coming week — the third counter of the header. */
  weekEventsCount: number;
  /** Bars of «Когда людно», earliest hour first; empty when the venue has no history to average. */
  occupancy: PlaceOccupancyHour[];
  /** The hour the «сейчас» bar highlights; null outside the published hours. */
  occupancyNowHour: number | null;
  /** Months of the viewer's own visits, newest last (the grid draws three). */
  visitMonths: PlaceVisitMonth[];
  /** «+9» — visits outside the months the grid shows. */
  visitMonthsMore: number;
  /** The bookable unit of the venue; null when it rents nothing. */
  unitTitle: string | null;
  pricePerHourRub: number | null;
  cancelBefore: string | null;
  /** The next free windows, earliest first (the design lists three). */
  slots: PlaceSlot[];
  upcoming: PlaceUpcomingEvent[];
}

/** A waiting position on a window that is taken: the slot twin of the event waitlist (макет, экран 21). */
export interface SlotWaitlistEntry {
  id: string;
  slotId: string;
  placeId: string;
  userId: string;
  /** Position in the queue, from 1. */
  position: number;
  /** How many seats are being waited for («Ждём 2 места»). */
  seats: number;
}

/**
 * Экран 21 card of a booked window. The two names are not the same thing and the design prints both:
 * `unitTitle` identifies the thing inside the venue («беседка №4») and rides the line over the card,
 * `activity` is what you booked it for («Мангал у залива») and is the headline.
 */
export interface MySlotBookingCard {
  booking: SlotBooking;
  slot: PlaceSlot;
  place: Place;
  unitTitle: string;
  activity: string;
  company: Friend[];
}

/** Экран 21 card of a waiting position; the two names are split the same way as on a booked window. */
export interface MySlotWaitlistCard {
  entry: SlotWaitlistEntry;
  slot: PlaceSlot;
  place: Place;
  unitTitle: string;
  activity: string;
}

/** What the slot domain contributes to экран 21; the tickets of the screen come from the calendar. */
export interface MySlotsBoard {
  bookings: MySlotBookingCard[];
  waitlist: MySlotWaitlistCard[];
}

/**
 * The entry code of one booking. Neither Booking nor the slot booking carries such a field today
 * (#492), and the check-in domain stores visits, not codes — so a future backend either puts the
 * code on the booking DTO or answers this list, and the screen joins it by booking id either way.
 */
export interface CheckInCode {
  /** Id of the booking the code belongs to: an event booking or a slot booking. */
  bookingId: string;
  code: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isNullableNumber = (value: unknown): value is number | null => value === null || typeof value === "number";

const isNullableString = (value: unknown): value is string | null => value === null || typeof value === "string";

/** A raw -> value parser (null means «not this shape») wrapped into what the transport validates with. */
function schemaOf<T>(name: string, parse: (raw: unknown) => T | null): ZodSchema<T> {
  return {
    safeParse(data: unknown) {
      const parsed = parse(data);
      return parsed === null ? { success: false as const, error: `invalid ${name}` } : { success: true as const, data: parsed };
    },
  };
}

/** The same parser over an array: one invalid item invalidates the answer, like a zod array does. */
function arrayOf<T>(parse: (raw: unknown) => T | null): (raw: unknown) => T[] | null {
  return (raw) => {
    if (!Array.isArray(raw)) return null;
    const items: T[] = [];
    for (const item of raw) {
      const parsed = parse(item);
      if (parsed === null) return null;
      items.push(parsed);
    }
    return items;
  };
}

/** Distinguishes «no forecast» (a valid null) from «broken forecast», which the null of a parser cannot. */
function parseWeather(raw: unknown): { weather: EventWeather | null } | null {
  if (raw === null || raw === undefined) return { weather: null };
  const parsed = EventWeatherSchema.safeParse(raw);
  return parsed.success ? { weather: parsed.data } : null;
}

function parseFriends(raw: unknown): Friend[] | null {
  return arrayOf((item) => {
    const parsed = FriendSchema.safeParse(item);
    return parsed.success ? parsed.data : null;
  })(raw);
}

function parsePlace(raw: unknown): Place | null {
  const parsed = PlaceSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function parseSlot(raw: unknown): PlaceSlot | null {
  if (!isRecord(raw)) return null;
  const { id, placeId, startsAt, endsAt, capacity, takenSeats, priceRub, status, busyUntil } = raw;
  if (typeof id !== "string" || typeof placeId !== "string" || typeof startsAt !== "string" || typeof endsAt !== "string") return null;
  if (typeof capacity !== "number" || typeof takenSeats !== "number" || !isNullableNumber(priceRub) || !isNullableString(busyUntil)) return null;
  if (typeof status !== "string" || !(SLOT_STATUSES as readonly string[]).includes(status)) return null;
  const weather = parseWeather(raw.weather);
  if (weather === null) return null;
  return { id, placeId, startsAt, endsAt, capacity, takenSeats, priceRub, status: status as SlotStatus, busyUntil, weather: weather.weather };
}

function parseSlotDay(raw: unknown): SlotDay | null {
  if (!isRecord(raw) || typeof raw.date !== "string" || typeof raw.hasFreeSlots !== "boolean") return null;
  const weather = parseWeather(raw.weather);
  return weather === null ? null : { date: raw.date, weather: weather.weather, hasFreeSlots: raw.hasFreeSlots };
}

function parseExtra(raw: unknown): SlotExtra | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.title !== "string" || typeof raw.priceRub !== "number") return null;
  return { id: raw.id, title: raw.title, priceRub: raw.priceRub };
}

function parseStrings(raw: unknown): string[] | null {
  return arrayOf((item) => (typeof item === "string" ? item : null))(raw);
}

function parseSlotBoard(raw: unknown): SlotBoard | null {
  if (!isRecord(raw) || typeof raw.unitTitle !== "string" || typeof raw.date !== "string" || !isNullableNumber(raw.pricePerHourRub) || !isNullableString(raw.cancelBefore)) return null;
  const place = parsePlace(raw.place);
  const amenities = parseStrings(raw.amenities);
  const extras = arrayOf(parseExtra)(raw.extras);
  const days = arrayOf(parseSlotDay)(raw.days);
  const slots = arrayOf(parseSlot)(raw.slots);
  const company = parseFriends(raw.company);
  const candidates = parseFriends(raw.candidates);
  if (place === null || amenities === null || extras === null || days === null || slots === null || company === null || candidates === null) return null;
  return { place, unitTitle: raw.unitTitle, pricePerHourRub: raw.pricePerHourRub, cancelBefore: raw.cancelBefore, amenities, extras, days, date: raw.date, slots, company, candidates };
}

function parseBooking(raw: unknown): SlotBooking | null {
  if (!isRecord(raw)) return null;
  const { id, slotId, placeId, userId, status, checkInCode, partySize, totalRub, cancelBefore, createdAt, updatedAt } = raw;
  if (typeof id !== "string" || typeof slotId !== "string" || typeof placeId !== "string" || typeof userId !== "string") return null;
  if (status !== "active" && status !== "cancelled") return null;
  if (typeof checkInCode !== "string" || typeof partySize !== "number" || typeof totalRub !== "number" || !isNullableString(cancelBefore)) return null;
  if (typeof createdAt !== "string" || typeof updatedAt !== "string") return null;
  const extraIds = parseStrings(raw.extraIds);
  if (extraIds === null) return null;
  return { id, slotId, placeId, userId, status, checkInCode, partySize, extraIds, totalRub, cancelBefore, createdAt, updatedAt };
}

function parseChatMessage(raw: unknown): SlotChatMessage | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.bookingId !== "string" || typeof raw.authorName !== "string") return null;
  if (raw.authorKind !== "venue" && raw.authorKind !== "member") return null;
  if (typeof raw.text !== "string" || typeof raw.sentAt !== "string") return null;
  return { id: raw.id, bookingId: raw.bookingId, authorKind: raw.authorKind, authorName: raw.authorName, text: raw.text, sentAt: raw.sentAt };
}

function parseBookingScreen(raw: unknown): SlotBookingScreen | null {
  if (!isRecord(raw) || typeof raw.unitTitle !== "string" || typeof raw.freeSeats !== "number") return null;
  if (!isNullableNumber(raw.distanceKm) || !isNullableNumber(raw.travelMinutes)) return null;
  const booking = parseBooking(raw.booking);
  const slot = parseSlot(raw.slot);
  const place = parsePlace(raw.place);
  const company = parseFriends(raw.company);
  const chat = arrayOf(parseChatMessage)(raw.chat);
  if (booking === null || slot === null || place === null || company === null || chat === null) return null;
  return { booking, slot, place, unitTitle: raw.unitTitle, company, freeSeats: raw.freeSeats, distanceKm: raw.distanceKm, travelMinutes: raw.travelMinutes, chat };
}

function parseOccupancyHour(raw: unknown): PlaceOccupancyHour | null {
  if (!isRecord(raw) || typeof raw.hour !== "number" || typeof raw.load !== "number") return null;
  return { hour: raw.hour, load: raw.load };
}

function parseVisitMonth(raw: unknown): PlaceVisitMonth | null {
  if (!isRecord(raw) || typeof raw.month !== "string" || typeof raw.visitsCount !== "number") return null;
  return { month: raw.month, visitsCount: raw.visitsCount };
}

function parseUpcoming(raw: unknown): PlaceUpcomingEvent | null {
  if (!isRecord(raw) || typeof raw.friendsCount !== "number" || typeof raw.goingCount !== "number" || typeof raw.joined !== "boolean") return null;
  const event = EventSchema.safeParse(raw.event);
  const friends = parseFriends(raw.friends);
  if (!event.success || friends === null) return null;
  return { event: event.data, friends, friendsCount: raw.friendsCount, goingCount: raw.goingCount, joined: raw.joined };
}

function parsePlaceBoard(raw: unknown): PlaceBoard | null {
  if (!isRecord(raw) || typeof raw.placeId !== "string" || !isNullableString(raw.openUntil) || typeof raw.checkedInToday !== "boolean") return null;
  if (typeof raw.weekEventsCount !== "number" || typeof raw.visitMonthsMore !== "number") return null;
  if (!isNullableString(raw.unitTitle) || !isNullableNumber(raw.pricePerHourRub) || !isNullableString(raw.cancelBefore)) return null;
  if (raw.occupancyNowHour !== null && typeof raw.occupancyNowHour !== "number") return null;
  const occupancy = arrayOf(parseOccupancyHour)(raw.occupancy);
  const visitMonths = arrayOf(parseVisitMonth)(raw.visitMonths);
  const slots = arrayOf(parseSlot)(raw.slots);
  const upcoming = arrayOf(parseUpcoming)(raw.upcoming);
  if (occupancy === null || visitMonths === null || slots === null || upcoming === null) return null;
  return {
    placeId: raw.placeId,
    openUntil: raw.openUntil,
    checkedInToday: raw.checkedInToday,
    weekEventsCount: raw.weekEventsCount,
    occupancy,
    occupancyNowHour: raw.occupancyNowHour,
    visitMonths,
    visitMonthsMore: raw.visitMonthsMore,
    unitTitle: raw.unitTitle,
    pricePerHourRub: raw.pricePerHourRub,
    cancelBefore: raw.cancelBefore,
    slots,
    upcoming,
  };
}

function parseWaitlistEntry(raw: unknown): SlotWaitlistEntry | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.slotId !== "string" || typeof raw.placeId !== "string" || typeof raw.userId !== "string") return null;
  if (typeof raw.position !== "number" || typeof raw.seats !== "number") return null;
  return { id: raw.id, slotId: raw.slotId, placeId: raw.placeId, userId: raw.userId, position: raw.position, seats: raw.seats };
}

function parseMySlots(raw: unknown): MySlotsBoard | null {
  if (!isRecord(raw)) return null;
  const bookings = arrayOf((item) => {
    if (!isRecord(item) || typeof item.unitTitle !== "string" || typeof item.activity !== "string") return null;
    const booking = parseBooking(item.booking);
    const slot = parseSlot(item.slot);
    const place = parsePlace(item.place);
    const company = parseFriends(item.company);
    if (booking === null || slot === null || place === null || company === null) return null;
    return { booking, slot, place, unitTitle: item.unitTitle, activity: item.activity, company };
  })(raw.bookings);
  const waitlist = arrayOf((item) => {
    if (!isRecord(item) || typeof item.unitTitle !== "string" || typeof item.activity !== "string") return null;
    const entry = parseWaitlistEntry(item.entry);
    const slot = parseSlot(item.slot);
    const place = parsePlace(item.place);
    if (entry === null || slot === null || place === null) return null;
    return { entry, slot, place, unitTitle: item.unitTitle, activity: item.activity };
  })(raw.waitlist);
  return bookings === null || waitlist === null ? null : { bookings, waitlist };
}

function parseCheckInCode(raw: unknown): CheckInCode | null {
  if (!isRecord(raw) || typeof raw.bookingId !== "string" || typeof raw.code !== "string") return null;
  return { bookingId: raw.bookingId, code: raw.code };
}

const PlaceBoardSchema = schemaOf("place board", parsePlaceBoard);
const SlotBoardSchema = schemaOf("slot board", parseSlotBoard);
const SlotBookingSchema = schemaOf("slot booking", parseBooking);
const SlotBookingScreenSchema = schemaOf("slot booking screen", parseBookingScreen);
const MySlotsBoardSchema = schemaOf("my slots board", parseMySlots);
const SlotWaitlistEntrySchema = schemaOf("slot waitlist entry", parseWaitlistEntry);
const CheckInCodesSchema = schemaOf("check-in code list", arrayOf(parseCheckInCode));

export function withSlots<TBase extends ApiMixin>(Base: TBase) {
  return class SlotEndpoints extends Base {
    /** Everything экран 34 needs beyond the place page aggregate; occupancy is live, slots stay empty until #492. */
    getPlaceBoard(placeId: string, userId: string): Promise<PlaceBoard> {
      return this.request(`/places/${placeId}/board?userId=${encodeURIComponent(userId)}`, PlaceBoardSchema);
    }

    /** Windows of one venue on one day; the day is a Moscow calendar key, omitted for the first published day. */
    getSlotBoard(placeId: string, date?: string): Promise<SlotBoard> {
      const params = new URLSearchParams({ placeId });
      if (date !== undefined) params.set("date", date);
      return this.request(`/slots?${params.toString()}`, SlotBoardSchema);
    }

    createSlotBooking(payload: CreateSlotBooking): Promise<SlotBooking> {
      return this.request("/slots/bookings", SlotBookingSchema, { body: payload });
    }

    getSlotBooking(bookingId: string): Promise<SlotBookingScreen> {
      return this.request(`/slots/bookings/${bookingId}`, SlotBookingScreenSchema);
    }

    cancelSlotBooking(bookingId: string): Promise<SlotBooking> {
      return this.request(`/slots/bookings/${bookingId}`, SlotBookingSchema, { method: "DELETE" });
    }

    /** Own slot bookings and waiting positions; the userId param is ignored server-side, identity comes from initData. */
    listMySlots(userId: string): Promise<MySlotsBoard> {
      return this.request(`/slots/my?userId=${encodeURIComponent(userId)}`, MySlotsBoardSchema);
    }

    joinSlotWaitlist(slotId: string, seats = 1): Promise<SlotWaitlistEntry> {
      return this.request("/slots/waitlist", SlotWaitlistEntrySchema, { body: { slotId, seats } });
    }

    leaveSlotWaitlist(entryId: string): Promise<SlotWaitlistEntry> {
      return this.request(`/slots/waitlist/${entryId}`, SlotWaitlistEntrySchema, { method: "DELETE" });
    }

    /** Entry codes of the viewer's active bookings, keyed by booking id. */
    listCheckInCodes(userId: string): Promise<CheckInCode[]> {
      return this.request(`/check-in-codes?userId=${encodeURIComponent(userId)}`, CheckInCodesSchema);
    }
  };
}
