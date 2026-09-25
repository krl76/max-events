// START_MODULE_CONTRACT
// PURPOSE: Mock route table for the promotion surfaces the viewer sees: the placements and the targeted collections (#205).
// SCOPE: GET /api/promotions/placements, GET /api/promotions/for-me.
// DEPENDS: ./promo.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - promoRoutes - route table entry: null when the path belongs to another domain
// END_MODULE_MAP

import { mockPromotionPlacements, mockTargetedPromotions } from "./promo";

export function promoRoutes(url: URL): Response | null {
  if (url.pathname === "/api/promotions/placements") {
    return Response.json(mockPromotionPlacements());
  }
  if (url.pathname === "/api/promotions/for-me") {
    return Response.json(mockTargetedPromotions());
  }
  return null;
}
