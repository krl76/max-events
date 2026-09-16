// START_MODULE_CONTRACT
// PURPOSE: Auth state machine over the MAX Bridge initData and the backend /auth/login endpoint.
// SCOPE: Three auth outcomes (authenticated inside MAX, unavailable outside MAX, server error), no session persistence.
// DEPENDS: ../max/bridge.js (MaxWebApp type), ../api/client.js, @max-events/api-contracts (User)
// LINKS: M-APP-MINIAPP, DF-MAX-IDENTITY, DF-AUTH-LOGIN
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AuthState - loading | authenticated | unavailable | error
// - authenticate - resolve AuthState from a nullable WebApp and a login function
// - LoginFn - injectable login dependency of authenticate
// END_MODULE_MAP

import type { User } from "@max-events/api-contracts";
import type { MaxWebApp } from "../max/bridge";

export type AuthState = { status: "loading" } | { status: "authenticated"; user: User } | { status: "unavailable" } | { status: "error"; message: string };

export type LoginFn = (payload: { initData: string }) => Promise<{ user: User }>;

export async function authenticate(app: Pick<MaxWebApp, "initData"> | null, login: LoginFn): Promise<AuthState> {
  if (!app?.initData) return { status: "unavailable" };
  try {
    const { user } = await login({ initData: app.initData });
    return { status: "authenticated", user };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "auth failed" };
  }
}
