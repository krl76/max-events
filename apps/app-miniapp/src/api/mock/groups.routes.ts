// START_MODULE_CONTRACT
// PURPOSE: Mock route table for the «Мы» groups and the shared event vote.
// SCOPE: GET/POST /api/we-groups, POST /api/we-groups/:id/(events|places|archive), GET /api/we-groups/:id, POST /api/votes, POST /api/votes/:id/ballots, GET /api/votes/:id.
// DEPENDS: ./groups.js, ./fixtures.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - groupsRoutes - route table entry: null when the path belongs to another domain
// END_MODULE_MAP

import { CreateVoteWriteSchema, CreateWeGroupWriteSchema, IdSchema, VoteBallotWriteSchema } from "@max-events/api-contracts";
import { parseBookingBody } from "./fixtures";
import { archiveMockWeGroup, bindMockWeGroupItem, castMockBallot, createMockVote, createMockWeGroup, getMockVote, getMockWeGroup, listMockWeGroups } from "./groups";

export function groupsRoutes(url: URL, init: RequestInit | undefined): Response | null {
  if (url.pathname === "/api/we-groups" && init?.method === "POST") {
    const parsed = CreateWeGroupWriteSchema.safeParse(parseBookingBody(init));
    if (!parsed.success || parsed.data.title.trim() === "") return new Response(null, { status: 400 });
    const created = createMockWeGroup(parsed.data);
    return created === "unknown_user" ? new Response(null, { status: 404 }) : Response.json(created);
  }
  if (url.pathname === "/api/we-groups") {
    return Response.json(listMockWeGroups());
  }
  const weGroupAction = /^\/api\/we-groups\/([^/]+)\/(events|places|archive)$/.exec(url.pathname);
  if (weGroupAction && init?.method === "POST") {
    if (!IdSchema.safeParse(weGroupAction[1]).success) return new Response(null, { status: 400 });
    if (weGroupAction[2] === "archive") {
      const archived = archiveMockWeGroup(weGroupAction[1]);
      return archived === "unknown" ? new Response(null, { status: 404 }) : archived === "forbidden" ? new Response(null, { status: 403 }) : Response.json(archived);
    }
    const body = parseBookingBody(init);
    const itemId = body?.[weGroupAction[2] === "events" ? "eventId" : "placeId"];
    const parsedId = IdSchema.safeParse(itemId);
    if (!parsedId.success) return new Response(null, { status: 400 });
    const bound = bindMockWeGroupItem(weGroupAction[1], weGroupAction[2] === "events" ? "event" : "place", parsedId.data);
    return bound === "unknown" || bound === "no_target" ? new Response(null, { status: 404 }) : bound === "forbidden" ? new Response(null, { status: 403 }) : bound === "archived" ? new Response(null, { status: 409 }) : Response.json(bound);
  }
  const weGroupById = /^\/api\/we-groups\/([^/]+)$/.exec(url.pathname);
  if (weGroupById) {
    if (!IdSchema.safeParse(weGroupById[1]).success) return new Response(null, { status: 400 });
    const screen = getMockWeGroup(weGroupById[1]);
    return screen === "unknown" ? new Response(null, { status: 404 }) : screen === "forbidden" ? new Response(null, { status: 403 }) : Response.json(screen);
  }
  if (url.pathname === "/api/votes" && init?.method === "POST") {
    const parsed = CreateVoteWriteSchema.safeParse(parseBookingBody(init));
    if (!parsed.success) return new Response(null, { status: 400 });
    const created = createMockVote(parsed.data);
    return created === "invalid" ? new Response(null, { status: 400 }) : created === "no_event" ? new Response(null, { status: 404 }) : Response.json(created);
  }
  const voteBallots = /^\/api\/votes\/([^/]+)\/ballots$/.exec(url.pathname);
  if (voteBallots && init?.method === "POST") {
    if (!IdSchema.safeParse(voteBallots[1]).success) return new Response(null, { status: 400 });
    const parsed = VoteBallotWriteSchema.safeParse(parseBookingBody(init));
    if (!parsed.success) return new Response(null, { status: 400 });
    const result = castMockBallot(voteBallots[1], parsed.data.eventId);
    return result === "unknown" ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : result === "invalid" ? new Response(null, { status: 400 }) : Response.json(result);
  }
  const voteById = /^\/api\/votes\/([^/]+)$/.exec(url.pathname);
  if (voteById) {
    if (!IdSchema.safeParse(voteById[1]).success) return new Response(null, { status: 400 });
    const result = getMockVote(voteById[1]);
    return result === "unknown" ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : Response.json(result);
  }
  return null;
}
