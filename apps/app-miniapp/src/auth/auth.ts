// START_MODULE_CONTRACT
// PURPOSE: Auth state machine over the MAX Bridge initData and the backend /auth/login endpoint.
// SCOPE: Three auth outcomes (authenticated inside MAX, unavailable outside MAX, server error), no session persistence.
// DEPENDS: ../max/bridge.js (MaxWebApp type), ../api/client.js, @max-events/api-contracts (User)
// LINKS: M-APP-MINIAPP, DF-MAX-IDENTITY, DF-AUTH-LOGIN
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AuthState - loading | authenticated | unavailable | error
// - waitForInitData - startapp cold start: WebApp is there, initData arrives a tick later
// - authenticate - resolve AuthState from a nullable WebApp and a login function (a non-null mock user short-circuits to authenticated — demo/QA mode)
// - LoginFn - injectable login dependency of authenticate
// END_MODULE_MAP

import type { User } from "@max-events/api-contracts";
import type { MaxWebApp } from "../max/bridge";

export type AuthState = { status: "loading" } | { status: "authenticated"; user: User } | { status: "unavailable" } | { status: "error"; message: string };

export type LoginFn = (payload: { initData: string }) => Promise<{ user: User }>;

/**
 * A startapp launch from a MAX chat sometimes mounts WebApp before initData is filled.
 * Poll only while the bridge object exists — outside MAX this returns immediately.
 */
export async function waitForInitData(
  read: () => string | undefined | null,
  bridgePresent: () => boolean,
  pause: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<string | null> {
  const immediate = read()?.trim() ?? "";
  if (immediate) return immediate;
  if (!bridgePresent()) return null;
  for (const ms of [40, 40, 80, 80, 160]) {
    await pause(ms);
    const next = read()?.trim() ?? "";
    if (next) return next;
  }
  const last = read()?.trim() ?? "";
  return last || null;
}

export async function authenticate(app: Pick<MaxWebApp, "initData"> | null, login: LoginFn, mockUser: User | null = null): Promise<AuthState> {
  if (mockUser) return { status: "authenticated", user: mockUser };
  if (!app?.initData) return { status: "unavailable" };
  try {
    const { user } = await login({ initData: app.initData });
    return { status: "authenticated", user };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "auth failed" };
  }
}
