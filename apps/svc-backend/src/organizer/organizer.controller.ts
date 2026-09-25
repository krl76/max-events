// START_MODULE_CONTRACT
// PURPOSE: HTTP surface for the organizer panel — own events/places including drafts, publish.
// SCOPE: GET /organizer/events, GET /organizer/places, POST create draft, POST publish, promocodes, campaigns, promotions, sales over an optional from/to period, GET/PATCH /organizer/setup, POST /organizer/setup/complete.
// DEPENDS: @nestjs/common, ../events, ../places, ../promo, ../promotion, ../organizations, ../auth
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OrganizerController - mine lists, draft create, publish, organizer setup
// END_MODULE_MAP

import { BadRequestException, Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { CreateEventSchema, CreatePlaceSchema, CreatePromoCampaignWriteSchema, CreatePromoCodeWriteSchema, CreatePromotionWriteSchema, EarlyAccessWriteSchema, RecordPromotionPaymentWriteSchema, UpdateOrganizerSetupSchema, type BookingWithSeats, type Event, type EventSalesReport, type OrganizerBookingRow, type OrganizerSetup, type Place, type PromoCampaign, type PromoCode, type PromotionCampaign } from "@max-events/api-contracts";
import { CurrentUser } from "../auth/auth.guard";
import { EventsService } from "../events/events.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { PlacesService } from "../places/places.service";
import { PromoService } from "../promo/promo.service";
import { BookingsService } from "../bookings/bookings.service";
import { PaymentsService } from "../payments/payments.service";
import { PromotionService } from "../promotion/promotion.service";
import { parseStatsPeriod } from "../stats/stats.controller";
import { UserEntity } from "../users/user.entity";

@Controller("organizer")
export class OrganizerController {
  constructor(
    @Inject(EventsService) private readonly events: EventsService,
    @Inject(PlacesService) private readonly places: PlacesService,
    @Inject(PromoService) private readonly promo: PromoService,
    @Inject(PromotionService) private readonly promotions: PromotionService,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
    @Inject(BookingsService) private readonly bookings: BookingsService,
    @Inject(OrganizationsService) private readonly organizations: OrganizationsService,
  ) {}

  @Get("setup")
  getSetup(@CurrentUser() user: UserEntity): Promise<OrganizerSetup> {
    return this.organizations.getSetup(user.id);
  }

  @Patch("setup")
  async updateSetup(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<OrganizerSetup> {
    const parsed = UpdateOrganizerSetupSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid organizer setup");
    return this.organizations.updateSetup(user.id, parsed.data);
  }

  @Post("setup/complete")
  completeSetup(@CurrentUser() user: UserEntity): Promise<OrganizerSetup> {
    return this.organizations.completeSetup(user.id);
  }

  @Get("events")
  listEvents(@CurrentUser() user: UserEntity): Promise<Event[]> {
    return this.events.listMine(user.id);
  }

  @Post("events")
  async createEventDraft(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<Event> {
    const parsed = CreateEventSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid event payload");
    return this.events.create(parsed.data, user.id, { draft: true });
  }

  @Post("events/:id/publish")
  publishEvent(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<Event> {
    return this.events.publish(id, user.id);
  }

  @Get("places")
  listPlaces(@CurrentUser() user: UserEntity): Promise<Place[]> {
    return this.places.listMine(user.id);
  }

  @Post("places")
  async createPlaceDraft(@CurrentUser() user: UserEntity, @Body() body: unknown): Promise<Place> {
    const parsed = CreatePlaceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid place payload");
    return this.places.create(parsed.data, user.id, { draft: true });
  }

  @Post("places/:id/publish")
  publishPlace(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<Place> {
    return this.places.publish(id, user.id);
  }

  @Post("events/:id/promocodes")
  async createPromo(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown): Promise<PromoCode> {
    const parsed = CreatePromoCodeWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid promo payload");
    return this.promo.create(user.id, id, parsed.data);
  }

  @Get("events/:id/promocodes")
  listPromos(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<PromoCode[]> {
    return this.promo.list(user.id, id);
  }

  @Post("events/:id/early-access")
  async earlyAccess(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown): Promise<{ bookingOpensAt: string }> {
    const parsed = EarlyAccessWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid early-access payload");
    return this.promo.setEarlyAccess(user.id, id, new Date(parsed.data.bookingOpensAt));
  }

  @Get("events/:id/bookings")
  listBookings(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<OrganizerBookingRow[]> {
    return this.promo.listBookings(user.id, id);
  }

  @Get("events/:id/sales")
  sales(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string, @Query("from") from?: string, @Query("to") to?: string): Promise<EventSalesReport> {
    return this.payments.salesReport(user.id, id, parseStatsPeriod(from, to));
  }

  @Post("events/:id/bookings/:bookingId/refund")
  refundBooking(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) _eventId: string, @Param("bookingId", ParseUUIDPipe) bookingId: string): Promise<BookingWithSeats> {
    return this.bookings.cancel(user.id, bookingId, { organizerId: user.id });
  }

  @Post("events/:id/campaigns")
  async createCampaign(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown): Promise<PromoCampaign> {
    const parsed = CreatePromoCampaignWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid campaign payload");
    return this.promo.createCampaign(user.id, id, parsed.data);
  }

  @Get("events/:id/campaigns")
  listCampaigns(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<PromoCampaign[]> {
    return this.promo.listCampaigns(user.id, id);
  }

  @Post("events/:id/promotions")
  async createPromotion(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string, @Body() body: unknown): Promise<PromotionCampaign> {
    const parsed = CreatePromotionWriteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid promotion payload");
    return this.promotions.create(user.id, id, parsed.data);
  }

  @Get("events/:id/promotions")
  listPromotions(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string): Promise<PromotionCampaign[]> {
    return this.promotions.list(user.id, id);
  }

  @Post("events/:id/promotions/:campaignId/paid")
  async payPromotion(@CurrentUser() user: UserEntity, @Param("id", ParseUUIDPipe) id: string, @Param("campaignId", ParseUUIDPipe) campaignId: string, @Body() body: unknown): Promise<PromotionCampaign> {
    const parsed = RecordPromotionPaymentWriteSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException("Invalid promotion payment payload");
    return this.promotions.recordPayment(user.id, id, campaignId, parsed.data);
  }
}
