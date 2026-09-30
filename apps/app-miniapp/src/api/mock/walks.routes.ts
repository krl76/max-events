// START_MODULE_CONTRACT
// PURPOSE: Mock route table for city walks.
// SCOPE: POST/GET /api/walks, GET/DELETE /api/walks/:id, PATCH /api/walks/:id/stops/:order. Null when the path belongs to another domain.
// DEPENDS: ./walks.js, ./fixtures.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - walksRoutes - route table entry
// END_MODULE_MAP

import { ComposeCityWalkWriteSchema, IdSchema, SetCityWalkStopDoneWriteSchema } from "@max-events/api-contracts";
import { parseBookingBody } from "./fixtures";
import { composeMockWalk, deleteMockWalk, getMockWalk, listMockWalks, setMockWalkStopDone } from "./walks";

export function walksRoutes(url: URL, init: RequestInit | undefined): Response | null {
  const done = /^\/api\/walks\/([^/]+)\/stops\/([^/]+)$/.exec(url.pathname);
  if (done && init?.method === "PATCH") {
    if (!IdSchema.safeParse(done[1]).success) return new Response(null, { status: 400 });
    const order = Number(done[2]);
    if (!Number.isInteger(order) || order < 1) return new Response(null, { status: 404 });
    const parsed = SetCityWalkStopDoneWriteSchema.safeParse(parseBookingBody(init));
    if (!parsed.success) return new Response(null, { status: 400 });
    const updated = setMockWalkStopDone(done[1], order, parsed.data.done);
    return updated === "missing" ? new Response(null, { status: 404 }) : Response.json(updated);
  }
  const byId = /^\/api\/walks\/([^/]+)$/.exec(url.pathname);
  if (byId) {
    if (!IdSchema.safeParse(byId[1]).success) return new Response(null, { status: 400 });
    if (init?.method === "DELETE") {
      return deleteMockWalk(byId[1]) ? new Response(null, { status: 204 }) : new Response(null, { status: 404 });
    }
    const walk = getMockWalk(byId[1]);
    return walk === null ? new Response(null, { status: 404 }) : Response.json(walk);
  }
  if (url.pathname !== "/api/walks") return null;
  if (init?.method === "POST") {
    const parsed = ComposeCityWalkWriteSchema.safeParse(parseBookingBody(init));
    if (!parsed.success) return new Response(null, { status: 400 });
    const created = composeMockWalk(parsed.data);
    return created === "no_sights" ? Response.json({ code: "no_sights" }, { status: 422 }) : Response.json(created);
  }
  return Response.json(listMockWalks());
}
