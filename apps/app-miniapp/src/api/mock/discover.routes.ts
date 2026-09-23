// START_MODULE_CONTRACT
// PURPOSE: Mock route table for the discovery surfaces: the today digest, the «Куда пойдём?» wizard, the nearby timeline with its free-window chains and the NL assistant.
// SCOPE: GET /api/today, GET /api/whereto, GET /api/nearby[/free], POST /api/assist[/day].
// DEPENDS: ./discover.js, ./fixtures.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - discoverRoutes - route table entry: null when the path belongs to another domain
// END_MODULE_MAP

import { AssistQueryWriteSchema, LeisureMoodSchema, WheretoQuerySchema } from "@max-events/api-contracts";
import { leisureOptions, mockAssistDay, mockAssistSuggest, nearbyTimeline, todayPicks, wheretoSuggestions } from "./discover";
import { parseBookingBody, parseMockCoords } from "./fixtures";

export function discoverRoutes(url: URL, init: RequestInit | undefined): Response | null {
  if (url.pathname === "/api/today") {
    return Response.json(todayPicks());
  }
  if (url.pathname === "/api/whereto") {
    const parsed = WheretoQuerySchema.safeParse({ company: url.searchParams.get("company"), mood: url.searchParams.get("mood"), budget: url.searchParams.get("budget") });
    if (!parsed.success) return new Response(null, { status: 400 });
    return Response.json(wheretoSuggestions(parsed.data));
  }
  if (url.pathname === "/api/nearby/free") {
    const coords = parseMockCoords(url);
    const hours = Number(url.searchParams.get("hours"));
    const mood = LeisureMoodSchema.safeParse(url.searchParams.get("mood"));
    if (coords === null || !Number.isInteger(hours) || hours < 1 || hours > 8 || !mood.success) return new Response(null, { status: 400 });
    return Response.json(leisureOptions(hours, mood.data, coords[0], coords[1]));
  }
  if (url.pathname === "/api/nearby") {
    const coords = parseMockCoords(url);
    if (coords === null) return new Response(null, { status: 400 });
    return Response.json(nearbyTimeline(coords[0], coords[1]));
  }
  if (url.pathname === "/api/assist/day" && init?.method === "POST") {
    const parsed = AssistQueryWriteSchema.safeParse(parseBookingBody(init));
    if (!parsed.success) return new Response(null, { status: 400 });
    const result = mockAssistDay(parsed.data);
    return result === "rate_limited" ? new Response(null, { status: 429 }) : result === "invalid" || result === "no_events" ? new Response(null, { status: 400 }) : Response.json(result);
  }
  if (url.pathname === "/api/assist" && init?.method === "POST") {
    const parsed = AssistQueryWriteSchema.safeParse(parseBookingBody(init));
    if (!parsed.success) return new Response(null, { status: 400 });
    const result = mockAssistSuggest(parsed.data);
    return result === "rate_limited" ? new Response(null, { status: 429 }) : result === "invalid" ? new Response(null, { status: 400 }) : Response.json(result);
  }
  return null;
}
