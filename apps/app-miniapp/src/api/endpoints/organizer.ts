// START_MODULE_CONTRACT
// PURPOSE: Organizer endpoints of the api client: the event and place panel, the sales and stats reports, the period summary and the event day (attendance, waitlist, check-in), the promo surface and the promotion placements the viewer sees.
// SCOPE: /organizer/events|places, PATCH /events|places/:id, GET|PATCH /organizer/setup, POST /organizer/setup/complete, /organizer/events/:id/{sales,stats,bookings,options,attendance,check-ins,waitlist/invites,campaigns,promotions,promocodes,early-access}, GET /organizer/summary, POST /views, the organizer ratings and GET /promotions/{placements,for-me}.
// DEPENDS: ./transport.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OrganizerEvent - contract event plus the draft flag read from the raw `published` field (returned by toEventDto; a missing flag reads as published)
// - OrganizerPlace - contract place plus the draft flag read from the raw `published` field (returned by toPlaceDto; a missing flag reads as published)
// - UpdateOrganizerEvent - minimal event edit payload (backend PATCH /events/:id whitelist)
// - UpdateOrganizerPlace - place edit payload (backend PATCH /places/:id validates CreatePlaceSchema.partial())
// - OrganizerActivity - re-exported activity of an organization
// - OrganizerSetupStep - re-exported step of the setup rail
// - OrganizerPayoutMode - re-exported payout mode
// - OrganizerSetupPayouts - re-exported payouts half of the setup
// - OrganizerSetup - re-exported setup state
// - UpdateOrganizerSetup - re-exported setup patch
// - StatsPeriodQuery - optional from/to window for the organizer reports
// - statsPeriodQuery - period into a ?from&to query string
// - ORGANIZER_TRAFFIC_SOURCES - where a booking came from, in the order экраны 45 и 48 list it
// - OrganizerTrafficSource - union of the traffic sources
// - OrganizerTrafficShare - one «Откуда приходят» row: source + its percent
// - OrganizerSummary - organizer-wide period report of экраны 45 и 48: totals, the weekday histogram, the traffic split (no backend counts attribution yet)
// - OrganizerRecurrence - «Повторять каждую неделю» of экран 46: the rule and the date the series runs to
// - OrganizerEventOptions - the four switches экран 46 owns that the Event contract has no field for (waitlist, in-app registration, external link, recurrence)
// - UpdateOrganizerEventOptions - partial OrganizerEventOptions patch
// - OrganizerParticipant - one row of «Отметились»/«Ждём» on экран 47: booking, guest, arrival stamp
// - OrganizerWaitlistEntry - one row of the waitlist tab of экран 47
// - OrganizerSlot - one venue slot chip of экран 47 (the slots domain does not exist yet, #492)
// - OrganizerAttendance - the event day of экран 47: counters, participants, waitlist, slots
// - organizerEntryCode - entry code of a booking: the last six characters of its id, uppercased (no code column exists yet)
// - ORGANIZER_ACTIVITIES - re-export of the contract «чем занимаетесь» enum
// - ORGANIZER_SETUP_STEPS - re-export of the contract rail
// - ORGANIZER_PAYOUT_MODES - re-export: external | none (no in-app live charges)
// - OrganizerSetupVenue - re-export of the venue half of GET/PATCH /organizer/setup
// - withOrganizer - the organizer event/place surface, the sales/stats reports (#196), the period summary and the event day (макет, экраны 42/44/45), the organizer ratings (#199), the campaign/promotion/promocode surface (#206, #372), the promotion placements (#205) and the настройка state of экран 44 (#537)
// END_MODULE_MAP

import { EarlyAccessWriteSchema, EventSalesReportSchema, EventSchema, OrganizerBookingRowSchema, OrganizerEventStatsSchema, OrganizerRatingResponseSchema, OrganizerSetupSchema, PlaceSchema, PromoCampaignSchema, PromoCodeSchema, PromotionCampaignSchema, PromotionPlacementsSchema, TargetedPromotionsResponseSchema } from "@max-events/api-contracts";
import type { CreateEvent, CreatePlace, CreatePromoCampaignWrite, CreatePromoCodeWrite, CreatePromotionWrite, EarlyAccessWrite, Event, EventSalesReport, OrganizerBookingRow, OrganizerEventStats, OrganizerRatingResponse, OrganizerSetup, Place, PromoCampaign, PromoCode, PromotionCampaign, PromotionPlacements, RecordPageViewWrite, TargetedPromotionsResponse, UpdateOrganizerSetup } from "@max-events/api-contracts";
export { ORGANIZER_ACTIVITIES, ORGANIZER_PAYOUT_MODES, ORGANIZER_SETUP_STEPS } from "@max-events/api-contracts";
export type { OrganizerActivity, OrganizerPayoutMode, OrganizerSetup, OrganizerSetupPayouts, OrganizerSetupStep, OrganizerSetupVenue, UpdateOrganizerSetup } from "@max-events/api-contracts";
import type { ApiMixin, ZodSchema } from "./transport";

/** Organizer panel item: the contract entity plus the draft flag. The backend organizer DTO omits `published`, so a missing flag reads as published (drafts are only distinguishable when the payload carries published=false). */
export type OrganizerEvent = Event & { draft: boolean };
export type OrganizerPlace = Place & { draft: boolean };

/** Editable event fields. The backend PATCH whitelist also accepts description, category, city and placeId. */
export type UpdateOrganizerEvent = Partial<Pick<CreateEvent, "title" | "description" | "category" | "city" | "placeId" | "startsAt" | "endsAt" | "isPaid" | "priceRub" | "paymentUrl" | "capacity">>;

/** Editable place fields (backend PATCH /places/:id validates CreatePlaceSchema.partial()). */
export type UpdateOrganizerPlace = Partial<CreatePlace>;

function organizerItem<T>(schema: ZodSchema<T>, data: unknown): (T & { draft: boolean }) | null {
  const parsed = schema.safeParse(data);
  if (!parsed.success) return null;
  const draft = typeof data === "object" && data !== null && (data as Record<string, unknown>).published === false;
  return { ...parsed.data, draft };
}

const OrganizerEventEntitySchema: ZodSchema<OrganizerEvent> = {
  safeParse(data: unknown) {
    const item = organizerItem(EventSchema, data);
    return item === null ? { success: false as const, error: "invalid organizer event" } : { success: true as const, data: item };
  },
};

const OrganizerPlaceEntitySchema: ZodSchema<OrganizerPlace> = {
  safeParse(data: unknown) {
    const item = organizerItem(PlaceSchema, data);
    return item === null ? { success: false as const, error: "invalid organizer place" } : { success: true as const, data: item };
  },
};

const OrganizerEventArraySchema: ZodSchema<OrganizerEvent[]> = {
  safeParse(data: unknown) {
    if (!Array.isArray(data)) return { success: false as const, error: "expected an array of organizer events" };
    const events: OrganizerEvent[] = [];
    for (const item of data) {
      const parsed = OrganizerEventEntitySchema.safeParse(item);
      if (!parsed.success) return { success: false as const, error: parsed.error };
      events.push(parsed.data);
    }
    return { success: true as const, data: events };
  },
};

const OrganizerPlaceArraySchema: ZodSchema<OrganizerPlace[]> = {
  safeParse(data: unknown) {
    if (!Array.isArray(data)) return { success: false as const, error: "expected an array of organizer places" };
    const places: OrganizerPlace[] = [];
    for (const item of data) {
      const parsed = OrganizerPlaceEntitySchema.safeParse(item);
      if (!parsed.success) return { success: false as const, error: parsed.error };
      places.push(parsed.data);
    }
    return { success: true as const, data: places };
  },
};

const PageViewResultSchema: ZodSchema<{ recorded: boolean }> = {
  safeParse(data: unknown) {
    if (typeof data !== "object" || data === null || typeof (data as Record<string, unknown>).recorded !== "boolean") return { success: false as const, error: "expected a page-view result" };
    return { success: true as const, data: data as { recorded: boolean } };
  },
};

/** Reporting window for the organizer stats and sales endpoints; omitted sides mean "all time". */
export interface StatsPeriodQuery {
  from?: string;
  to?: string;
}

export function statsPeriodQuery(period: StatsPeriodQuery): string {
  const parts = [period.from ? `from=${encodeURIComponent(period.from)}` : "", period.to ? `to=${encodeURIComponent(period.to)}` : ""].filter((part) => part !== "");
  return parts.length === 0 ? "" : `?${parts.join("&")}`;
}

function record(data: unknown): Record<string, unknown> | null {
  return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null;
}

function nullableNumber(value: unknown): boolean {
  return value === null || typeof value === "number";
}

function nullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

/** Rows come back as arrays of one shape; a single item guard is enough to validate the whole list. */
function arraySchema<T>(item: (raw: Record<string, unknown>) => T | null, what: string): ZodSchema<T[]> {
  return {
    safeParse(data: unknown) {
      if (!Array.isArray(data)) return { success: false as const, error: `expected an array of ${what}` };
      const rows: T[] = [];
      for (const entry of data) {
        const raw = record(entry);
        const parsed = raw === null ? null : item(raw);
        if (parsed === null) return { success: false as const, error: `invalid ${what}` };
        rows.push(parsed);
      }
      return { success: true as const, data: rows };
    },
  };
}

/** Where a booking came from (макет, экраны 45 и 48, «Откуда приходят»), in the order the screens list it. */
export const ORGANIZER_TRAFFIC_SOURCES = ["chats", "feed", "search"] as const;
export type OrganizerTrafficSource = (typeof ORGANIZER_TRAFFIC_SOURCES)[number];

export interface OrganizerTrafficShare {
  source: OrganizerTrafficSource;
  percent: number;
}

export const ORGANIZER_LEAD_BUCKETS = ["same_day", "days_1_3", "days_4_7", "earlier"] as const;
export type OrganizerLeadBucket = (typeof ORGANIZER_LEAD_BUCKETS)[number];

export interface OrganizerLeadShare {
  bucket: OrganizerLeadBucket;
  percent: number;
}

/** Organizer-wide report over a period: the numbers экран 45 puts in its hero and экран 48 in its tiles and charts. */
export interface OrganizerSummary {
  bookings: number;
  /** Change against the previous window of the same length; null when there is no previous window to compare with. */
  bookingsDeltaPercent: number | null;
  attendedPercent: number | null;
  cancelledPercent: number | null;
  /** Seven booking counts, Monday first — the bars of «Заполнение за неделю» and «Записи по дням». */
  byWeekday: number[];
  sources: OrganizerTrafficShare[];
  views: number;
  conversionPercent: number | null;
  occupancyPercent: number | null;
  seatsBooked: number;
  seatsCapacity: number;
  events: number;
  soldOut: number;
  uniqueGuests: number;
  repeatGuestPercent: number | null;
  newGuestPercent: number | null;
  waitlist: number;
  lead: OrganizerLeadShare[];
}

function trafficShare(raw: Record<string, unknown>): OrganizerTrafficShare | null {
  const source = raw.source;
  if (typeof source !== "string" || !ORGANIZER_TRAFFIC_SOURCES.includes(source as OrganizerTrafficSource)) return null;
  if (typeof raw.percent !== "number") return null;
  return { source: source as OrganizerTrafficSource, percent: raw.percent };
}

function leadShare(raw: Record<string, unknown>): OrganizerLeadShare | null {
  const bucket = raw.bucket;
  if (typeof bucket !== "string" || !ORGANIZER_LEAD_BUCKETS.includes(bucket as OrganizerLeadBucket)) return null;
  if (typeof raw.percent !== "number") return null;
  return { bucket: bucket as OrganizerLeadBucket, percent: raw.percent };
}

const OrganizerSummarySchema: ZodSchema<OrganizerSummary> = {
  safeParse(data: unknown) {
    const raw = record(data);
    if (raw === null || typeof raw.bookings !== "number" || !nullableNumber(raw.bookingsDeltaPercent) || !nullableNumber(raw.attendedPercent) || !nullableNumber(raw.cancelledPercent)) return { success: false as const, error: "expected an organizer summary" };
    if (typeof raw.views !== "number" || !nullableNumber(raw.conversionPercent) || !nullableNumber(raw.occupancyPercent) || typeof raw.seatsBooked !== "number" || typeof raw.seatsCapacity !== "number" || typeof raw.events !== "number" || typeof raw.soldOut !== "number" || typeof raw.uniqueGuests !== "number" || !nullableNumber(raw.repeatGuestPercent) || !nullableNumber(raw.newGuestPercent) || typeof raw.waitlist !== "number") return { success: false as const, error: "expected organizer funnel counters" };
    if (!Array.isArray(raw.byWeekday) || raw.byWeekday.length !== 7 || raw.byWeekday.some((value) => typeof value !== "number")) return { success: false as const, error: "expected seven weekday counters" };
    if (!Array.isArray(raw.sources)) return { success: false as const, error: "expected traffic sources" };
    const sources: OrganizerTrafficShare[] = [];
    for (const entry of raw.sources) {
      const parsed = record(entry) === null ? null : trafficShare(entry as Record<string, unknown>);
      if (parsed === null) return { success: false as const, error: "invalid traffic source" };
      sources.push(parsed);
    }
    if (!Array.isArray(raw.lead) || raw.lead.length !== 4) return { success: false as const, error: "expected four lead buckets" };
    const lead: OrganizerLeadShare[] = [];
    for (const entry of raw.lead) {
      const parsed = record(entry) === null ? null : leadShare(entry as Record<string, unknown>);
      if (parsed === null) return { success: false as const, error: "invalid lead bucket" };
      lead.push(parsed);
    }
    return {
      success: true as const,
      data: {
        bookings: raw.bookings,
        bookingsDeltaPercent: raw.bookingsDeltaPercent as number | null,
        attendedPercent: raw.attendedPercent as number | null,
        cancelledPercent: raw.cancelledPercent as number | null,
        byWeekday: raw.byWeekday as number[],
        sources,
        views: raw.views,
        conversionPercent: raw.conversionPercent as number | null,
        occupancyPercent: raw.occupancyPercent as number | null,
        seatsBooked: raw.seatsBooked,
        seatsCapacity: raw.seatsCapacity,
        events: raw.events,
        soldOut: raw.soldOut,
        uniqueGuests: raw.uniqueGuests,
        repeatGuestPercent: raw.repeatGuestPercent as number | null,
        newGuestPercent: raw.newGuestPercent as number | null,
        waitlist: raw.waitlist,
        lead,
      },
    };
  },
};

/** «Повторять каждую неделю» (макет, экран 46): the only rule the screen offers, plus the date the series runs to. */
export interface OrganizerRecurrence {
  rule: "weekly";
  until: string;
}

/**
 * The switches экран 46 carries that the Event contract has no column for. They travel as one sub-resource
 * rather than as extra event fields, so the day the backend grows them the screen keeps its calls.
 */
export interface OrganizerEventOptions {
  eventId: string;
  waitlistEnabled: boolean;
  registrationInApp: boolean;
  externalUrl: string | null;
  recurrence: OrganizerRecurrence | null;
}

export type UpdateOrganizerEventOptions = Partial<Omit<OrganizerEventOptions, "eventId">>;

function recurrence(value: unknown): OrganizerRecurrence | null | "invalid" {
  if (value === null) return null;
  const raw = record(value);
  if (raw === null || raw.rule !== "weekly" || typeof raw.until !== "string") return "invalid";
  return { rule: "weekly", until: raw.until };
}

const OrganizerEventOptionsSchema: ZodSchema<OrganizerEventOptions> = {
  safeParse(data: unknown) {
    const raw = record(data);
    if (raw === null || typeof raw.eventId !== "string" || typeof raw.waitlistEnabled !== "boolean" || typeof raw.registrationInApp !== "boolean" || !nullableString(raw.externalUrl)) return { success: false as const, error: "expected organizer event options" };
    const repeat = recurrence(raw.recurrence);
    if (repeat === "invalid") return { success: false as const, error: "invalid recurrence" };
    return { success: true as const, data: { eventId: raw.eventId, waitlistEnabled: raw.waitlistEnabled, registrationInApp: raw.registrationInApp, externalUrl: raw.externalUrl as string | null, recurrence: repeat } };
  },
};

/** One «Отметились»/«Ждём» row of экран 47. `guests` counts the companions a booking brings along. */
export interface OrganizerParticipant {
  bookingId: string;
  userId: string;
  name: string;
  guests: number;
  checkedInAt: string | null;
  bookedAt: string;
}

export interface OrganizerWaitlistEntry {
  entryId: string;
  userId: string;
  name: string;
  guests: number;
  joinedAt: string;
}

/** One chip of «Слоты площадки». The slots domain does not exist yet (#492), so this rides the event day. */
export interface OrganizerSlot {
  id: string;
  startsAt: string;
  endsAt: string;
  busy: boolean;
}

export interface OrganizerAttendance {
  eventId: string;
  capacity: number | null;
  bookedCount: number;
  waitlistCount: number;
  checkedInCount: number;
  /** Seats cancellations gave back — what «Освободилось N мест» offers to the waitlist. */
  freedSeats: number;
  chatMessages: number | null;
  participants: OrganizerParticipant[];
  waitlist: OrganizerWaitlistEntry[];
  slots: OrganizerSlot[];
}

function participant(raw: Record<string, unknown>): OrganizerParticipant | null {
  if (typeof raw.bookingId !== "string" || typeof raw.userId !== "string" || typeof raw.name !== "string" || typeof raw.guests !== "number" || !nullableString(raw.checkedInAt) || typeof raw.bookedAt !== "string") return null;
  return { bookingId: raw.bookingId, userId: raw.userId, name: raw.name, guests: raw.guests, checkedInAt: raw.checkedInAt as string | null, bookedAt: raw.bookedAt };
}

function waitlistEntry(raw: Record<string, unknown>): OrganizerWaitlistEntry | null {
  if (typeof raw.entryId !== "string" || typeof raw.userId !== "string" || typeof raw.name !== "string" || typeof raw.guests !== "number" || typeof raw.joinedAt !== "string") return null;
  return { entryId: raw.entryId, userId: raw.userId, name: raw.name, guests: raw.guests, joinedAt: raw.joinedAt };
}

function slot(raw: Record<string, unknown>): OrganizerSlot | null {
  if (typeof raw.id !== "string" || typeof raw.startsAt !== "string" || typeof raw.endsAt !== "string" || typeof raw.busy !== "boolean") return null;
  return { id: raw.id, startsAt: raw.startsAt, endsAt: raw.endsAt, busy: raw.busy };
}

const OrganizerParticipantSchema: ZodSchema<OrganizerParticipant> = {
  safeParse(data: unknown) {
    const raw = record(data);
    const parsed = raw === null ? null : participant(raw);
    return parsed === null ? { success: false as const, error: "expected an organizer participant" } : { success: true as const, data: parsed };
  },
};

const OrganizerAttendanceSchema: ZodSchema<OrganizerAttendance> = {
  safeParse(data: unknown) {
    const raw = record(data);
    if (raw === null || typeof raw.eventId !== "string" || !nullableNumber(raw.capacity) || typeof raw.bookedCount !== "number" || typeof raw.waitlistCount !== "number" || typeof raw.checkedInCount !== "number" || typeof raw.freedSeats !== "number" || !nullableNumber(raw.chatMessages)) return { success: false as const, error: "expected an organizer attendance payload" };
    const participants = arraySchema(participant, "participants").safeParse(raw.participants);
    const waitlist = arraySchema(waitlistEntry, "waitlist entries").safeParse(raw.waitlist);
    const slots = arraySchema(slot, "slots").safeParse(raw.slots);
    if (!participants.success || !waitlist.success || !slots.success) return { success: false as const, error: "invalid organizer attendance rows" };
    return { success: true as const, data: { eventId: raw.eventId, capacity: raw.capacity as number | null, bookedCount: raw.bookedCount, waitlistCount: raw.waitlistCount, checkedInCount: raw.checkedInCount, freedSeats: raw.freedSeats, chatMessages: raw.chatMessages as number | null, participants: participants.data, waitlist: waitlist.data, slots: slots.data } };
  },
};

export interface OrganizerEventReview {
  id: string;
  name: string;
  stars: number;
  wouldGoAgain: boolean;
  text: string | null;
  photos: Array<{ url: string }>;
  factTags: string[];
  categoryScores: { atmosphere?: number; organization?: number; price?: number; place?: number };
  createdAt: string;
}

const OrganizerEventReviewArraySchema: ZodSchema<OrganizerEventReview[]> = {
  safeParse(data: unknown) {
    if (!Array.isArray(data)) return { success: false as const, error: "expected organizer reviews" };
    const rows: OrganizerEventReview[] = [];
    for (const item of data) {
      const raw = record(item);
      if (raw === null || typeof raw.id !== "string" || typeof raw.name !== "string" || typeof raw.stars !== "number" || typeof raw.wouldGoAgain !== "boolean" || !nullableString(raw.text) || typeof raw.createdAt !== "string") {
        return { success: false as const, error: "invalid organizer review" };
      }
      const photos = Array.isArray(raw.photos) ? raw.photos.flatMap((photo) => (typeof photo === "object" && photo !== null && typeof (photo as { url?: unknown }).url === "string" ? [{ url: (photo as { url: string }).url }] : [])) : [];
      const factTags = Array.isArray(raw.factTags) ? raw.factTags.filter((tag): tag is string => typeof tag === "string") : [];
      const scores = typeof raw.categoryScores === "object" && raw.categoryScores !== null ? (raw.categoryScores as OrganizerEventReview["categoryScores"]) : {};
      rows.push({ id: raw.id, name: raw.name, stars: raw.stars, wouldGoAgain: raw.wouldGoAgain, text: raw.text as string | null, photos, factTags, categoryScores: scores, createdAt: raw.createdAt });
    }
    return { success: true as const, data: rows };
  },
};

const WaitlistInviteResultSchema: ZodSchema<{ invited: number }> = {
  safeParse(data: unknown) {
    const raw = record(data);
    if (raw === null || typeof raw.invited !== "number") return { success: false as const, error: "expected a waitlist invite result" };
    return { success: true as const, data: { invited: raw.invited } };
  },
};

/**
 * The entry code a guest shows at the door. Derived from the booking id — the same function the
 * backend uses — so the scanner and the ticket always agree.
 */
export function organizerEntryCode(bookingId: string): string {
  return bookingId.replace(/-/g, "").slice(-6).toUpperCase();
}

export function withOrganizer<TBase extends ApiMixin>(Base: TBase) {
  return class OrganizerEndpoints extends Base {
    getPromotionPlacements(): Promise<PromotionPlacements> {
      return this.request("/promotions/placements", PromotionPlacementsSchema);
    }

    getTargetedPromotions(): Promise<TargetedPromotionsResponse> {
      return this.request("/promotions/for-me", TargetedPromotionsResponseSchema);
    }

    listOrganizerEvents(): Promise<OrganizerEvent[]> {
      return this.request("/organizer/events", OrganizerEventArraySchema);
    }

    async createOrganizerEvent(payload: CreateEvent): Promise<OrganizerEvent> {
      const created = await this.request("/organizer/events", OrganizerEventEntitySchema, { body: payload });
      return { ...created, draft: true };
    }

    updateOrganizerEvent(id: string, patch: UpdateOrganizerEvent): Promise<OrganizerEvent> {
      return this.request(`/events/${id}`, OrganizerEventEntitySchema, { method: "PATCH", body: patch });
    }

    async publishOrganizerEvent(id: string): Promise<OrganizerEvent> {
      const published = await this.request(`/organizer/events/${id}/publish`, OrganizerEventEntitySchema, { method: "POST" });
      return { ...published, draft: false };
    }

    async unpublishOrganizerEvent(id: string): Promise<OrganizerEvent> {
      const unpublished = await this.request(`/organizer/events/${id}/unpublish`, OrganizerEventEntitySchema, { method: "POST" });
      return { ...unpublished, draft: true };
    }

    listOrganizerEventReviews(eventId: string): Promise<OrganizerEventReview[]> {
      return this.request(`/organizer/events/${eventId}/reviews`, OrganizerEventReviewArraySchema);
    }

    listOrganizerPlaces(): Promise<OrganizerPlace[]> {
      return this.request("/organizer/places", OrganizerPlaceArraySchema);
    }

    async createOrganizerPlace(payload: CreatePlace): Promise<OrganizerPlace> {
      const created = await this.request("/organizer/places", OrganizerPlaceEntitySchema, { body: payload });
      return { ...created, draft: true };
    }

    updateOrganizerPlace(id: string, patch: UpdateOrganizerPlace): Promise<OrganizerPlace> {
      return this.request(`/places/${id}`, OrganizerPlaceEntitySchema, { method: "PATCH", body: patch });
    }

    async publishOrganizerPlace(id: string): Promise<OrganizerPlace> {
      const published = await this.request(`/organizer/places/${id}/publish`, OrganizerPlaceEntitySchema, { method: "POST" });
      return { ...published, draft: false };
    }

    getEventSales(eventId: string, period: StatsPeriodQuery = {}): Promise<EventSalesReport> {
      return this.request(`/organizer/events/${eventId}/sales${statsPeriodQuery(period)}`, EventSalesReportSchema);
    }

    getOrganizerEventStats(eventId: string, period: StatsPeriodQuery = {}): Promise<OrganizerEventStats> {
      return this.request(`/organizer/events/${eventId}/stats${statsPeriodQuery(period)}`, OrganizerEventStatsSchema);
    }

    recordPageView(payload: RecordPageViewWrite): Promise<{ recorded: boolean }> {
      return this.request("/views", PageViewResultSchema, { body: payload });
    }

    getEventOrganizerRating(eventId: string): Promise<OrganizerRatingResponse> {
      return this.request(`/events/${eventId}/organizer-rating`, OrganizerRatingResponseSchema);
    }

    getOrganizerRating(userId: string): Promise<OrganizerRatingResponse> {
      return this.request(`/organizers/${userId}/rating`, OrganizerRatingResponseSchema);
    }

    listCampaigns(eventId: string): Promise<PromoCampaign[]> {
      return this.request(`/organizer/events/${eventId}/campaigns`, PromoCampaignSchema.array());
    }

    createCampaign(eventId: string, payload: CreatePromoCampaignWrite): Promise<PromoCampaign> {
      return this.request(`/organizer/events/${eventId}/campaigns`, PromoCampaignSchema, { body: payload });
    }

    listPromotions(eventId: string): Promise<PromotionCampaign[]> {
      return this.request(`/organizer/events/${eventId}/promotions`, PromotionCampaignSchema.array());
    }

    createPromotion(eventId: string, payload: CreatePromotionWrite): Promise<PromotionCampaign> {
      return this.request(`/organizer/events/${eventId}/promotions`, PromotionCampaignSchema, { body: payload });
    }

    markPromotionPaid(eventId: string, campaignId: string, paidAt?: string): Promise<PromotionCampaign> {
      return this.request(`/organizer/events/${eventId}/promotions/${campaignId}/paid`, PromotionCampaignSchema, { body: paidAt === undefined ? {} : { paidAt } });
    }

    listOrganizerPromos(eventId: string): Promise<PromoCode[]> {
      return this.request(`/organizer/events/${eventId}/promocodes`, PromoCodeSchema.array());
    }

    createOrganizerPromo(eventId: string, payload: CreatePromoCodeWrite): Promise<PromoCode> {
      return this.request(`/organizer/events/${eventId}/promocodes`, PromoCodeSchema, { body: payload });
    }

    setOrganizerEarlyAccess(eventId: string, bookingOpensAt: string): Promise<EarlyAccessWrite> {
      return this.request(`/organizer/events/${eventId}/early-access`, EarlyAccessWriteSchema, { body: { bookingOpensAt } });
    }

    /** Backend OrganizerController.listBookings: who booked this event, with the promo code each used. */
    listOrganizerBookings(eventId: string): Promise<OrganizerBookingRow[]> {
      return this.request(`/organizer/events/${eventId}/bookings`, OrganizerBookingRowSchema.array());
    }

    getOrganizerSummary(period: StatsPeriodQuery = {}): Promise<OrganizerSummary> {
      return this.request(`/organizer/summary${statsPeriodQuery(period)}`, OrganizerSummarySchema);
    }

    getOrganizerEventOptions(eventId: string): Promise<OrganizerEventOptions> {
      return this.request(`/organizer/events/${eventId}/options`, OrganizerEventOptionsSchema);
    }

    updateOrganizerEventOptions(eventId: string, patch: UpdateOrganizerEventOptions): Promise<OrganizerEventOptions> {
      return this.request(`/organizer/events/${eventId}/options`, OrganizerEventOptionsSchema, { method: "PATCH", body: patch });
    }

    getOrganizerAttendance(eventId: string): Promise<OrganizerAttendance> {
      return this.request(`/organizer/events/${eventId}/attendance`, OrganizerAttendanceSchema);
    }

    /** Mark a guest as arrived by the code on their ticket (макет, экран 47, «Сканировать код»). */
    checkInOrganizerGuest(eventId: string, code: string): Promise<OrganizerParticipant> {
      return this.request(`/organizer/events/${eventId}/check-ins`, OrganizerParticipantSchema, { body: { code } });
    }

    /** Offer the freed seats to the first `count` people on the waitlist (макет, экран 47). */
    inviteFromOrganizerWaitlist(eventId: string, count: number): Promise<{ invited: number }> {
      return this.request(`/organizer/events/${eventId}/waitlist/invites`, WaitlistInviteResultSchema, { body: { count } });
    }

    /** The настройка state of экран 44: GET/PATCH /organizer/setup. */
    getOrganizerSetup(): Promise<OrganizerSetup> {
      return this.request("/organizer/setup", OrganizerSetupSchema);
    }

    updateOrganizerSetup(patch: UpdateOrganizerSetup): Promise<OrganizerSetup> {
      return this.request("/organizer/setup", OrganizerSetupSchema, { method: "PATCH", body: patch });
    }

    /** Stamps completedAt, after which the organizer lands on the dashboard instead of настройка. */
    completeOrganizerSetup(): Promise<OrganizerSetup> {
      return this.request("/organizer/setup/complete", OrganizerSetupSchema, { method: "POST" });
    }
  };
}
