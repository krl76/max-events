// START_MODULE_CONTRACT
// PURPOSE: The mock fetch interceptor: walks the per-domain route tables in order and falls back to the real fetch when no table claims the request.
// SCOPE: Composition and order only. A new endpoint goes into its domain's <domain>.routes.ts; this file changes only when a whole domain is added.
// DEPENDS: every ./<domain>.routes.js table
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - installMockApi - replace globalThis.fetch with the interceptor, return the restore function. The private ROUTE_TABLES below hold the matching order; organizerRoutes deliberately precedes catalogRoutes, because it answers the PATCH variants of /api/events/:id and /api/places/:id that the catalog GET branches would otherwise swallow
// END_MODULE_MAP

import { authRoutes } from "./auth.routes";
import { bookingsRoutes } from "./bookings.routes";
import { catalogRoutes } from "./catalog.routes";
import { discoverRoutes } from "./discover.routes";
import { feedRoutes } from "./feed.routes";
import { groupsRoutes } from "./groups.routes";
import { listsRoutes } from "./lists.routes";
import { moderationRoutes } from "./moderation.routes";
import { notificationsRoutes } from "./notifications.routes";
import { organizerRoutes } from "./organizer.routes";
import { plansRoutes } from "./plans.routes";
import { profileRoutes } from "./profile.routes";
import { promoRoutes } from "./promo.routes";
import { reviewsRoutes } from "./reviews.routes";
import { socialRoutes } from "./social.routes";
import { slotsRoutes } from "./slots.routes";
import { walksRoutes } from "./walks.routes";

type MockRouteTable = (url: URL, init: RequestInit | undefined) => Response | null;

const ROUTE_TABLES: readonly MockRouteTable[] = [feedRoutes, authRoutes, socialRoutes, profileRoutes, discoverRoutes, promoRoutes, organizerRoutes, catalogRoutes, reviewsRoutes, bookingsRoutes, plansRoutes, groupsRoutes, listsRoutes, moderationRoutes, slotsRoutes, notificationsRoutes, walksRoutes];

export function installMockApi(): () => void {
  const real = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (input instanceof Request) return real(input, init);
    const url = new URL(input, "http://mock.local");
    for (const table of ROUTE_TABLES) {
      const response = table(url, init);
      if (response !== null) return response;
    }
    return real(input, init);
  };
  return () => {
    globalThis.fetch = real;
  };
}
