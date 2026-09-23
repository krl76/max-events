// START_MODULE_CONTRACT
// PURPOSE: Organizer endpoints of the api client: the event and place panel, the sales and stats reports, the promo surface and the promotion placements the viewer sees.
// SCOPE: /organizer/events|places, PATCH /events|places/:id, /organizer/events/:id/{sales,stats,campaigns,promotions,promocodes,early-access}, POST /views, the organizer ratings and GET /promotions/{placements,for-me}.
// DEPENDS: ./transport.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OrganizerEvent - contract event plus the draft flag read from the raw `published` field (returned by toEventDto; a missing flag reads as published)
// - OrganizerPlace - contract place plus the draft flag read from the raw `published` field (returned by toPlaceDto; a missing flag reads as published)
// - UpdateOrganizerEvent - minimal event edit payload (backend PATCH /events/:id whitelist)
// - UpdateOrganizerPlace - place edit payload (backend PATCH /places/:id validates CreatePlaceSchema.partial())
// - StatsPeriodQuery - optional from/to window for the organizer reports
// - statsPeriodQuery - period into a ?from&to query string
// - withOrganizer - the organizer event/place surface, the sales/stats reports (#196), the organizer ratings (#199), the campaign/promotion/promocode surface (#206, #372) and the promotion placements (#205)
// END_MODULE_MAP

import { EarlyAccessWriteSchema, EventSalesReportSchema, EventSchema, OrganizerEventStatsSchema, OrganizerRatingResponseSchema, PlaceSchema, PromoCampaignSchema, PromoCodeSchema, PromotionCampaignSchema, PromotionPlacementsSchema, TargetedPromotionsResponseSchema } from "@max-events/api-contracts";
import type { CreateEvent, CreatePlace, CreatePromoCampaignWrite, CreatePromoCodeWrite, CreatePromotionWrite, EarlyAccessWrite, Event, EventSalesReport, OrganizerEventStats, OrganizerRatingResponse, Place, PromoCampaign, PromoCode, PromotionCampaign, PromotionPlacements, RecordPageViewWrite, TargetedPromotionsResponse } from "@max-events/api-contracts";
import type { ApiMixin, ZodSchema } from "./transport";

/** Organizer panel item: the contract entity plus the draft flag. The backend organizer DTO omits `published`, so a missing flag reads as published (drafts are only distinguishable when the payload carries published=false). */
export type OrganizerEvent = Event & { draft: boolean };
export type OrganizerPlace = Place & { draft: boolean };

/** Minimal editable event fields (backend PATCH /events/:id whitelist via pickEventFields). */
export type UpdateOrganizerEvent = Partial<Pick<CreateEvent, "title" | "startsAt" | "endsAt" | "isPaid" | "priceRub" | "paymentUrl" | "capacity">>;

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
  };
}
