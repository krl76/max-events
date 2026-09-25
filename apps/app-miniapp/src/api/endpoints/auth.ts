// START_MODULE_CONTRACT
// PURPOSE: Auth endpoints of the api client: the MAX init-data login and the organizer login.
// SCOPE: POST /auth/login, POST /auth/organizer/login.
// DEPENDS: ./transport.js, @max-events/api-contracts
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS, DF-MAX-IDENTITY
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - withAuth - ApiClient.login / organizerLogin
// END_MODULE_MAP

import { AuthResponseSchema, OrganizerSessionSchema } from "@max-events/api-contracts";
import type { AuthRequest, AuthResponse, OrganizerLoginWrite, OrganizerSession } from "@max-events/api-contracts";
import type { ApiMixin } from "./transport";

export function withAuth<TBase extends ApiMixin>(Base: TBase) {
  return class AuthEndpoints extends Base {
    login(payload: AuthRequest): Promise<AuthResponse> {
      return this.request("/auth/login", AuthResponseSchema, { body: payload });
    }

    getMe(): Promise<AuthResponse> {
      return this.request("/auth/me", AuthResponseSchema);
    }

    organizerLogin(payload: OrganizerLoginWrite): Promise<OrganizerSession> {
      return this.request("/auth/organizer/login", OrganizerSessionSchema, { body: payload });
    }
  };
}
