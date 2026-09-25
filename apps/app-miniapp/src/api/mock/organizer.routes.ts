// START_MODULE_CONTRACT
// PURPOSE: Mock route table for the organizer space: the event and place panel, the sales/stats reports, the period summary, the event day (options, attendance, check-in, waitlist offers), the organizer ratings, the promo surface and the page-view counter.
// SCOPE: PATCH /api/events|places/:id, /api/organizer/events|places[/:id/publish], POST /api/views, GET|PATCH /api/organizer/setup, POST /api/organizer/setup/complete, GET /api/organizer/summary, /api/organizer/events/:id/{stats,sales,bookings,options,attendance,check-ins,waitlist/invites,campaigns,promotions,promocodes,early-access}, /api/events/:id/organizer-rating, /api/organizers/:id/rating.
// DEPENDS: ./organizer.js, ./bookings.js, ./fixtures.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - organizerRoutes - route table entry: null when the path belongs to another domain. It runs before the catalog table so the PATCH variants of /api/events/:id and /api/places/:id are answered here, the way the single interceptor used to order them.
// END_MODULE_MAP

import { CreateEventSchema, CreatePlaceSchema, CreatePromoCampaignWriteSchema, CreatePromoCodeWriteSchema, CreatePromotionWriteSchema, EarlyAccessWriteSchema, IdSchema, RecordPageViewWriteSchema, RecordPromotionPaymentWriteSchema } from "@max-events/api-contracts";
import { mockBookings } from "./bookings";
import { mockDemoUser, parseBookingBody } from "./fixtures";
import { checkInMockOrganizerGuest, completeMockOrganizerSetup, createMockCampaign, createMockOrganizerEvent, createMockOrganizerPlace, createMockPromoCode, createMockPromotion, inviteMockOrganizerWaitlist, listMockCampaigns, listMockPromoCodes, listMockPromotions, mockEventOrganizerRating, mockEventSalesReport, mockOrganizerAttendance, mockOrganizerEventOptions, mockOrganizerEventStats, mockOrganizerRating, mockOrganizerSetup, mockOrganizerSummary, mockStatsPeriod, organizerEvents, organizerPlaces, payMockPromotion, publishMockOrganizerEvent, publishMockOrganizerPlace, recordMockPageView, setMockEarlyAccess, updateMockOrganizerEvent, updateMockOrganizerEventOptions, updateMockOrganizerPlace, updateMockOrganizerSetup } from "./organizer";

export function organizerRoutes(url: URL, init: RequestInit | undefined): Response | null {
  // Настройка организатора (макет, экран 44) — раньше остальных: /setup/complete иначе попал бы
  // под разбор события с id «setup».
  if (url.pathname === "/api/organizer/setup/complete" && init?.method === "POST") return Response.json(completeMockOrganizerSetup());
  if (url.pathname === "/api/organizer/setup") {
    if (init?.method !== "PATCH") return Response.json(mockOrganizerSetup());
    const result = updateMockOrganizerSetup(parseBookingBody(init) ?? {});
    return result === "invalid" ? new Response(null, { status: 400 }) : Response.json(result);
  }
  if (url.pathname === "/api/organizer/summary") {
    const period = mockStatsPeriod(url);
    return period === null ? new Response(null, { status: 400 }) : Response.json(mockOrganizerSummary(period));
  }
  const organizerEventOptions = /^\/api\/organizer\/events\/([^/]+)\/options$/.exec(url.pathname);
  if (organizerEventOptions) {
    const result = init?.method === "PATCH" ? updateMockOrganizerEventOptions(organizerEventOptions[1], parseBookingBody(init) ?? {}) : mockOrganizerEventOptions(organizerEventOptions[1]);
    return result === null ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : result === "invalid" ? new Response(null, { status: 400 }) : Response.json(result);
  }
  const organizerAttendance = /^\/api\/organizer\/events\/([^/]+)\/attendance$/.exec(url.pathname);
  if (organizerAttendance) {
    const result = mockOrganizerAttendance(organizerAttendance[1]);
    return result === null ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : Response.json(result);
  }
  const organizerCheckIn = /^\/api\/organizer\/events\/([^/]+)\/check-ins$/.exec(url.pathname);
  if (organizerCheckIn && init?.method === "POST") {
    const body = parseBookingBody(init) as { code?: unknown } | undefined;
    if (typeof body?.code !== "string") return new Response(null, { status: 400 });
    const result = checkInMockOrganizerGuest(organizerCheckIn[1], body.code);
    return result === null || result === "no_guest" ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : Response.json(result);
  }
  const organizerWaitlistInvites = /^\/api\/organizer\/events\/([^/]+)\/waitlist\/invites$/.exec(url.pathname);
  if (organizerWaitlistInvites && init?.method === "POST") {
    const body = parseBookingBody(init) as { count?: unknown } | undefined;
    if (typeof body?.count !== "number") return new Response(null, { status: 400 });
    const result = inviteMockOrganizerWaitlist(organizerWaitlistInvites[1], body.count);
    return result === null ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : result === "invalid" ? new Response(null, { status: 400 }) : Response.json(result);
  }
  const organizerBookings = /^\/api\/organizer\/events\/([^/]+)\/bookings$/.exec(url.pathname);
  if (organizerBookings && init?.method !== "POST") {
    const attendance = mockOrganizerAttendance(organizerBookings[1]);
    if (attendance === null) return new Response(null, { status: 404 });
    if (attendance === "forbidden") return new Response(null, { status: 403 });
    // Backend PromoService.listBookings parity: the booking rows themselves, with the promo code each used.
    return Response.json(mockBookings.filter((booking) => booking.eventId === organizerBookings[1]).map((booking) => ({ id: booking.id, userId: booking.userId, eventId: booking.eventId, status: booking.status, promoCode: null, createdAt: booking.createdAt })));
  }
  const eventPatch = /^\/api\/events\/([^/]+)$/.exec(url.pathname);
  if (eventPatch && init?.method === "PATCH") {
    const result = updateMockOrganizerEvent(eventPatch[1], parseBookingBody(init) ?? {});
    return result === null ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : result === "invalid" ? new Response(null, { status: 400 }) : Response.json(result);
  }
  const organizerPlacePatch = /^\/api\/places\/([^/]+)$/.exec(url.pathname);
  if (organizerPlacePatch && init?.method === "PATCH") {
    const result = updateMockOrganizerPlace(organizerPlacePatch[1], parseBookingBody(init) ?? {});
    return result === null ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : result === "invalid" ? new Response(null, { status: 400 }) : Response.json(result);
  }
  if (url.pathname === "/api/organizer/events" && init?.method === "POST") {
    const parsed = CreateEventSchema.safeParse(parseBookingBody(init));
    if (!parsed.success || (parsed.data.endsAt && new Date(parsed.data.endsAt) < new Date(parsed.data.startsAt))) return new Response(null, { status: 400 });
    return Response.json(createMockOrganizerEvent(parsed.data));
  }
  if (url.pathname === "/api/organizer/events") {
    return Response.json(organizerEvents());
  }
  const organizerEventPublish = /^\/api\/organizer\/events\/([^/]+)\/publish$/.exec(url.pathname);
  if (organizerEventPublish && init?.method === "POST") {
    const result = publishMockOrganizerEvent(organizerEventPublish[1]);
    return result === null ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : Response.json(result);
  }
  if (url.pathname === "/api/organizer/places" && init?.method === "POST") {
    const parsed = CreatePlaceSchema.safeParse(parseBookingBody(init));
    if (!parsed.success) return new Response(null, { status: 400 });
    return Response.json(createMockOrganizerPlace(parsed.data));
  }
  if (url.pathname === "/api/organizer/places") {
    return Response.json(organizerPlaces());
  }
  const organizerPlacePublish = /^\/api\/organizer\/places\/([^/]+)\/publish$/.exec(url.pathname);
  if (organizerPlacePublish && init?.method === "POST") {
    const result = publishMockOrganizerPlace(organizerPlacePublish[1]);
    return result === null ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : Response.json(result);
  }
  if (url.pathname === "/api/views" && init?.method === "POST") {
    const parsed = RecordPageViewWriteSchema.safeParse(parseBookingBody(init));
    if (!parsed.success) return new Response(null, { status: 400 });
    return Response.json(recordMockPageView(mockDemoUser.id, parsed.data));
  }
  const organizerEventStats = /^\/api\/organizer\/events\/([^/]+)\/stats$/.exec(url.pathname);
  if (organizerEventStats) {
    if (!IdSchema.safeParse(organizerEventStats[1]).success) return new Response(null, { status: 400 });
    const period = mockStatsPeriod(url);
    if (period === null) return new Response(null, { status: 400 });
    const result = mockOrganizerEventStats(organizerEventStats[1], period);
    return result === null ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : Response.json(result);
  }
  const organizerEventSales = /^\/api\/organizer\/events\/([^/]+)\/sales$/.exec(url.pathname);
  if (organizerEventSales) {
    if (!IdSchema.safeParse(organizerEventSales[1]).success) return new Response(null, { status: 400 });
    const period = mockStatsPeriod(url);
    if (period === null) return new Response(null, { status: 400 });
    const result = mockEventSalesReport(organizerEventSales[1], period);
    return result === null ? new Response(null, { status: 404 }) : Response.json(result);
  }
  const eventOrganizerRating = /^\/api\/events\/([^/]+)\/organizer-rating$/.exec(url.pathname);
  if (eventOrganizerRating) {
    if (!IdSchema.safeParse(eventOrganizerRating[1]).success) return new Response(null, { status: 400 });
    const result = mockEventOrganizerRating(eventOrganizerRating[1]);
    return result === null ? new Response(null, { status: 404 }) : Response.json(result);
  }
  const organizerRating = /^\/api\/organizers\/([^/]+)\/rating$/.exec(url.pathname);
  if (organizerRating) {
    if (!IdSchema.safeParse(organizerRating[1]).success) return new Response(null, { status: 400 });
    return Response.json(mockOrganizerRating(organizerRating[1]));
  }
  const organizerCampaigns = /^\/api\/organizer\/events\/([^/]+)\/campaigns$/.exec(url.pathname);
  if (organizerCampaigns && init?.method === "POST") {
    const parsed = CreatePromoCampaignWriteSchema.safeParse(parseBookingBody(init));
    if (!parsed.success) return new Response(null, { status: 400 });
    const result = createMockCampaign(organizerCampaigns[1], parsed.data);
    return result === null ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : result === "invalid" ? new Response(null, { status: 400 }) : result === "duplicate" ? new Response(null, { status: 409 }) : Response.json(result);
  }
  if (organizerCampaigns) {
    const result = listMockCampaigns(organizerCampaigns[1]);
    return result === null ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : Response.json(result);
  }
  const organizerPromotionPaid = /^\/api\/organizer\/events\/([^/]+)\/promotions\/([^/]+)\/paid$/.exec(url.pathname);
  if (organizerPromotionPaid && init?.method === "POST") {
    const parsed = RecordPromotionPaymentWriteSchema.safeParse(parseBookingBody(init) ?? {});
    if (!parsed.success) return new Response(null, { status: 400 });
    const result = payMockPromotion(organizerPromotionPaid[1], organizerPromotionPaid[2], parsed.data.paidAt);
    return result === null || result === "no_campaign" ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : Response.json(result);
  }
  const organizerPromotions = /^\/api\/organizer\/events\/([^/]+)\/promotions$/.exec(url.pathname);
  if (organizerPromotions && init?.method === "POST") {
    const parsed = CreatePromotionWriteSchema.safeParse(parseBookingBody(init));
    if (!parsed.success) return new Response(null, { status: 400 });
    const result = createMockPromotion(organizerPromotions[1], parsed.data);
    return result === null ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : result === "invalid" ? new Response(null, { status: 400 }) : Response.json(result);
  }
  if (organizerPromotions) {
    const result = listMockPromotions(organizerPromotions[1]);
    return result === null ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : Response.json(result);
  }
  const organizerPromocodes = /^\/api\/organizer\/events\/([^/]+)\/promocodes$/.exec(url.pathname);
  if (organizerPromocodes && init?.method === "POST") {
    const parsed = CreatePromoCodeWriteSchema.safeParse(parseBookingBody(init));
    if (!parsed.success) return new Response(null, { status: 400 });
    const result = createMockPromoCode(organizerPromocodes[1], parsed.data);
    return result === null ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : result === "invalid" ? new Response(null, { status: 400 }) : result === "duplicate" ? new Response(null, { status: 409 }) : Response.json(result);
  }
  if (organizerPromocodes) {
    const result = listMockPromoCodes(organizerPromocodes[1]);
    return result === null ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : Response.json(result);
  }
  const organizerEarlyAccess = /^\/api\/organizer\/events\/([^/]+)\/early-access$/.exec(url.pathname);
  if (organizerEarlyAccess && init?.method === "POST") {
    const parsed = EarlyAccessWriteSchema.safeParse(parseBookingBody(init));
    if (!parsed.success) return new Response(null, { status: 400 });
    const result = setMockEarlyAccess(organizerEarlyAccess[1], parsed.data.bookingOpensAt);
    return result === null ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : Response.json(result);
  }
  return null;
}
