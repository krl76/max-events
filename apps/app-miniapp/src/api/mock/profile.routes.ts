// START_MODULE_CONTRACT
// PURPOSE: Mock route table for the viewer's own profile, their visit history, achievements, my-city, taste graph, profile counters, post grid, follow directions and app settings.
// SCOPE: GET/PATCH /api/profile, GET /api/users/:id/{visit-stats,achievements,my-city,counters,visited-places,posts,following,followers}, GET/PATCH /api/users/:id/app-settings, GET /api/taste[/after-me]. The two follow directions are served here rather than in ./social.routes.ts because they are addressed by user, and /api/users/:id is this table's half of the url space; the data itself stays in the social graph store.
// DEPENDS: ./profile.js, ./social.js, ./fixtures.js, ../client.js, @max-events/api-contracts
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
import { achievementsFor, afterMePicks, appSettingsFor, mockCustomAvatars, mockProfiles, myCityFor, profileCountersFor, profileFor, tasteProfile, updateMockAppSettings, userFor, userPostsFor, visitStatsFor, visitedPlacesFor } from "./profile";
import { followersOf, followingOf } from "./social";

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
    if (parsed.data.avatarUrl !== undefined) {
      if (parsed.data.avatarUrl === null) mockCustomAvatars.delete(mockDemoUser.id);
      else mockCustomAvatars.set(mockDemoUser.id, parsed.data.avatarUrl);
    }
    const { avatarUrl: _avatarUrl, ...profilePatch } = parsed.data;
    const updated: Profile = { ...current, ...profilePatch, smartAlerts: { ...current.smartAlerts, ...profilePatch.smartAlerts }, privacy: { ...current.privacy, ...profilePatch.privacy }, recommendationsEnabled: profilePatch.recommendationsEnabled ?? current.recommendationsEnabled, bio: profilePatch.bio ?? current.bio, coverUrl: profilePatch.coverUrl === undefined ? current.coverUrl : profilePatch.coverUrl };
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
  const posts = /^\/api\/users\/([^/]+)\/posts$/.exec(url.pathname);
  if (posts) {
    return Response.json(userPostsFor(posts[1]));
  }
  const following = /^\/api\/users\/([^/]+)\/following$/.exec(url.pathname);
  if (following) {
    return Response.json(followingOf(following[1]));
  }
  const followers = /^\/api\/users\/([^/]+)\/followers$/.exec(url.pathname);
  if (followers) {
    return Response.json(followersOf(followers[1]));
  }
  const appSettings = /^\/api\/users\/([^/]+)\/app-settings$/.exec(url.pathname);
  if (appSettings) {
    if (init?.method !== "PATCH") return Response.json(appSettingsFor(appSettings[1]));
    const patch = parseBookingBody(init) as UpdateAppSettings | undefined;
    if (typeof patch !== "object" || patch === null) return new Response(null, { status: 400 });
    return Response.json(updateMockAppSettings(appSettings[1], patch));
  }
  const userProfile = /^\/api\/users\/([^/]+)\/profile$/.exec(url.pathname);
  if (userProfile) {
    const person = userFor(userProfile[1]);
    return person === null ? new Response(null, { status: 404 }) : Response.json(profileFor(person.id));
  }
  const userRow = /^\/api\/users\/([^/]+)$/.exec(url.pathname);
  if (userRow) {
    const person = userFor(userRow[1]);
    return person === null ? new Response(null, { status: 404 }) : Response.json(person);
  }
  return null;
}
