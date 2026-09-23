// START_MODULE_CONTRACT
// PURPOSE: Mock promotion store: the placements the catalog reads and the targeted collections of the viewer (#205).
// SCOPE: Placement fixtures and the promoted flag the event listing applies; the HTTP surface is in ./promo.routes.ts.
// DEPENDS: @max-events/api-contracts, ../client.js and the sibling ./mock domain modules it imports
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - mockPromotionPlacements - placements fixture: 2 banners, 1 pin, boosted ids, promoted=true (mock GET /promotions/placements, #205); the /api/events listing flags the placement events promoted (backend promotedEventIds parity)
// - MOCK_BOOSTED_EVENT_IDS - Event ids with an active boost placement: the /api/events listing sorts these first (backend EventsService.list boosted-first parity)
// - eventPromoted - Promoted-flag default: a placement event that is not already promoted fixture-wise carries promoted=true (backend promotedEventIds parity, applied in the listing, GET /events/:id and event details)
// - mockTargetedPromotions - one target collection with the explanation derived from the demo check-in history (mock GET /promotions/for-me, #205)
// END_MODULE_MAP

import type { Event, PromotionPlacements, TargetedPromotionsResponse } from "@max-events/api-contracts";
import { MOCK_TODAY, PLACE_STAMP, mockDemoUser, mockEvents, mockPlaces } from "./fixtures";
import { visitStatsFor } from "./profile";

/** Promotion placements fixture (mock GET /promotions/placements): two banners, one pin, boosted ids; placement events carry promoted=true (backend PromotionService.placements parity). */
export function mockPromotionPlacements(): PromotionPlacements {
  const promoted = (item: Event): Event => ({ ...item, promoted: true });
  return {
    banners: [mockEvents[0], mockEvents[5]].map(promoted),
    pins: [{ event: promoted(mockEvents[2]), place: mockPlaces[0] }],
    boostedEventIds: [mockEvents[7].id],
  };
}

/** Event ids with a placement campaign (banner/pin/boost): the mock /api/events listing flags them promoted (backend EventsService.list promotedEventIds parity). */
const MOCK_PLACEMENT_PROMOTED_IDS: ReadonlySet<string> = (() => {
  const placements = mockPromotionPlacements();
  return new Set([...placements.banners.map((item) => item.id), ...placements.pins.map((pin) => pin.event.id), ...placements.boostedEventIds]);
})();

/** Event ids with an active boost placement: the /api/events listing sorts these first (backend EventsService.list boosted-first parity). */
export const MOCK_BOOSTED_EVENT_IDS: ReadonlySet<string> = new Set(mockPromotionPlacements().boostedEventIds);

/** Promoted-flag default: a placement event that is not already promoted fixture-wise carries promoted=true (backend promotedEventIds parity, applied in the listing, GET /events/:id and event details). */
export const eventPromoted = (item: Event): Event => (MOCK_PLACEMENT_PROMOTED_IDS.has(item.id) && !item.promoted ? { ...item, promoted: true } : item);

/** Targeted collection fixture (mock GET /promotions/for-me): one target_collection row for the open-air cinema; the visit count in the explanation is derived from the demo user's mock check-in history (backend targetedFor parity). */
export function mockTargetedPromotions(): TargetedPromotionsResponse {
  const event = mockEvents[10];
  const visits = visitStatsFor(mockDemoUser.id).byCategory.find((row) => row.category === event.category)?.count ?? 0;
  return {
    collections: [
      {
        campaign: { id: "d1000000-0000-4000-8000-000000000001", eventId: event.id, type: "target_collection", status: "active", startsAt: `${MOCK_TODAY}T00:00:00+03:00`, endsAt: "2026-12-31T23:59:59+03:00", audience: { minVisits: 1, windowDays: 30, category: event.category }, createdAt: PLACE_STAMP, completedAt: null },
        event: { ...event, promoted: true },
        explanation: `${visits} посещений категории «афиша» за 30 дней`,
      },
    ],
  };
}
