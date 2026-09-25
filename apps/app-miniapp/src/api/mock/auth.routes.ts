// START_MODULE_CONTRACT
// PURPOSE: Mock route table for the organizer login, answering the same 401 the backend does for wrong credentials.
// SCOPE: POST /api/auth/organizer/login; the MAX init-data login never reaches the interceptor (mock auth is resolved in auth.ts).
// DEPENDS: ./fixtures.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP, DF-MAX-IDENTITY
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - authRoutes - route table entry: null when the path belongs to another domain
// END_MODULE_MAP

import { OrganizerLoginWriteSchema } from "@max-events/api-contracts";
import type { OrganizerSession } from "@max-events/api-contracts";
import { MOCK_ORGANIZER_CREDENTIALS, mockDemoUser, mockOrganization, parseBookingBody } from "./fixtures";
import { mockCustomAvatars } from "./profile";

export function authRoutes(url: URL, init: RequestInit | undefined): Response | null {
  if (url.pathname === "/api/auth/me") {
    return Response.json({ user: { ...mockDemoUser, avatarUrl: mockCustomAvatars.get(mockDemoUser.id) ?? mockDemoUser.avatarUrl } });
  }
  if (url.pathname === "/api/auth/organizer/login") {
    const parsed = OrganizerLoginWriteSchema.safeParse(parseBookingBody(init));
    if (!parsed.success || parsed.data.login !== MOCK_ORGANIZER_CREDENTIALS.login || parsed.data.password !== MOCK_ORGANIZER_CREDENTIALS.password) return new Response(null, { status: 401 });
    return Response.json({ token: "mock-organizer-token", organization: mockOrganization } satisfies OrganizerSession);
  }
  return null;
}
