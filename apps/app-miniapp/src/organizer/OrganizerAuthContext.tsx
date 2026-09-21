// START_MODULE_CONTRACT
// PURPOSE: Organizer authentication state — login/password session (bearer token) stored in localStorage, separate from the MAX user auth.
// SCOPE: OrganizerAuthProvider (restores a persisted session on mount), useOrganizerAuth hook, login/logout; session persistence via the storage key; the token is attached to apiClient via setOrganizerToken.
// DEPENDS: react, ../api/client.js (apiClient), @max-events/api-contracts (OrganizerSession)
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ORGANIZER_SESSION_KEY - localStorage key of the persisted OrganizerSession
// - OrganizerAuthState - loading | anonymous | authenticated | error
// - readStoredSession - parse the persisted session from storage (null when absent, malformed or schema-invalid)
// - OrganizerAuthProvider - restores the persisted session on mount and provides state + login/logout
// - useOrganizerAuth - read the organizer auth state and actions
// END_MODULE_MAP

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { OrganizerSessionSchema, type OrganizerSession } from "@max-events/api-contracts";
import { apiClient } from "../api/client";

export const ORGANIZER_SESSION_KEY = "max-events.organizer-session";

export type OrganizerAuthState = { status: "loading" } | { status: "anonymous" } | { status: "authenticated"; session: OrganizerSession } | { status: "error"; message: string };

interface OrganizerAuth {
  state: OrganizerAuthState;
  login: (login: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const OrganizerAuthContext = createContext<OrganizerAuth>({ state: { status: "loading" }, login: async () => false, logout: () => {} });

export function readStoredSession(storage: Pick<Storage, "getItem">): OrganizerSession | null {
  const raw = storage.getItem(ORGANIZER_SESSION_KEY);
  if (raw === null) return null;
  try {
    const parsed = OrganizerSessionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function OrganizerAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OrganizerAuthState>({ status: "loading" });

  useEffect(() => {
    const stored = typeof window === "undefined" ? null : readStoredSession(window.localStorage);
    if (stored) {
      apiClient.setOrganizerToken(stored.token);
      setState({ status: "authenticated", session: stored });
    } else {
      setState({ status: "anonymous" });
    }
  }, []);

  const login = useCallback(async (loginValue: string, password: string): Promise<boolean> => {
    try {
      const session = await apiClient.organizerLogin({ login: loginValue, password });
      apiClient.setOrganizerToken(session.token);
      window.localStorage.setItem(ORGANIZER_SESSION_KEY, JSON.stringify(session));
      setState({ status: "authenticated", session });
      return true;
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "login failed" });
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    apiClient.setOrganizerToken(null);
    window.localStorage.removeItem(ORGANIZER_SESSION_KEY);
    setState({ status: "anonymous" });
  }, []);

  const value = useMemo<OrganizerAuth>(() => ({ state, login, logout }), [state, login, logout]);
  return <OrganizerAuthContext.Provider value={value}>{children}</OrganizerAuthContext.Provider>;
}

export function useOrganizerAuth(): OrganizerAuth {
  return useContext(OrganizerAuthContext);
}
