// START_MODULE_CONTRACT
// PURPOSE: Mock route table for the viewer's own profile, their visit history, achievements, my-city, taste graph, profile counters and app settings.
// SCOPE: GET/PATCH /api/profile, GET /api/users/:id/{visit-stats,achievements,my-city,counters,visited-places}, GET/PATCH /api/users/:id/app-settings, GET /api/taste[/after-me].
// DEPENDS: ./profile.js, ./fixtures.js, ../client.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - profileRoutes - route table entry: null when the path belongs to another domain
// END_MODULE_MAP

import { UpdateProfileSchema } from "@max-events/api-contracts";
import type { Profile } from "@max-events/api-contracts";
import { type UpdateAppSettings } from "../client";
import { mockDemoUser, parseBookingBody } from "./fixtures";
import { achievementsFor, afterMePicks, appSettingsFor, mockProfiles, myCityFor, profileCountersFor, profileFor, tasteProfile, updateMockAppSettings, visitStatsFor, visitedPlacesFor } from "./profile";

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
  const counters = /^\/api\/users\/([^/]+)\/counters$/.exec(url.pathname);
  if (counters) {
    return Response.json(profileCountersFor(counters[1]));
  }
  const visitedPlaces = /^\/api\/users\/([^/]+)\/visited-places$/.exec(url.pathname);
  if (visitedPlaces) {
    return Response.json(visitedPlacesFor(visitedPlaces[1]));
  }
  const appSettings = /^\/api\/users\/([^/]+)\/app-settings$/.exec(url.pathname);
  if (appSettings) {
    if (init?.method !== "PATCH") return Response.json(appSettingsFor(appSettings[1]));
    const patch = parseBookingBody(init) as UpdateAppSettings | undefined;
    if (typeof patch !== "object" || patch === null) return new Response(null, { status: 400 });
    return Response.json(updateMockAppSettings(appSettings[1], patch));
  }
  return null;
}
