// START_MODULE_CONTRACT
// PURPOSE: Mock route table for the viewer's own profile, their visit history, achievements, my-city and taste graph.
// SCOPE: GET/PATCH /api/profile, GET /api/users/:id/{visit-stats,achievements,my-city}, GET /api/taste[/after-me].
// DEPENDS: ./profile.js, ./fixtures.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - profileRoutes - route table entry: null when the path belongs to another domain
// END_MODULE_MAP

import { UpdateProfileSchema } from "@max-events/api-contracts";
import type { Profile } from "@max-events/api-contracts";
import { mockDemoUser, parseBookingBody } from "./fixtures";
import { achievementsFor, afterMePicks, mockProfiles, myCityFor, profileFor, tasteProfile, visitStatsFor } from "./profile";

export function profileRoutes(url: URL, init: RequestInit | undefined): Response | null {
  if (url.pathname === "/api/taste") {
    return Response.json(tasteProfile(mockDemoUser.id));
  }
  if (url.pathname === "/api/taste/after-me") {
    return Response.json(afterMePicks(mockDemoUser.id));
  }
  if (url.pathname === "/api/profile" && init?.method === "PATCH") {
    const parsed = UpdateProfileSchema.safeParse(parseBookingBody(init));
    if (!parsed.success) return new Response(null, { status: 400 });
    const current = profileFor(mockDemoUser.id);
    const updated: Profile = { ...current, ...parsed.data, smartAlerts: { ...current.smartAlerts, ...parsed.data.smartAlerts }, privacy: { ...current.privacy, ...parsed.data.privacy }, recommendationsEnabled: parsed.data.recommendationsEnabled ?? current.recommendationsEnabled };
    mockProfiles.set(mockDemoUser.id, updated);
    return Response.json(updated);
  }
  if (url.pathname === "/api/profile") {
    return Response.json(profileFor(mockDemoUser.id));
  }
  const visitStats = /^\/api\/users\/([^/]+)\/visit-stats$/.exec(url.pathname);
  if (visitStats) {
    return Response.json(visitStatsFor(visitStats[1]));
  }
  const achievements = /^\/api\/users\/([^/]+)\/achievements$/.exec(url.pathname);
  if (achievements) {
    return Response.json(achievementsFor(visitStatsFor(achievements[1])));
  }
  const myCity = /^\/api\/users\/([^/]+)\/my-city$/.exec(url.pathname);
  if (myCity) {
    return Response.json(myCityFor(myCity[1]));
  }
  return null;
}
