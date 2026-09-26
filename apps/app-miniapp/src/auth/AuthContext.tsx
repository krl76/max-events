// START_MODULE_CONTRACT
// PURPOSE: React context exposing the AuthState resolved once at startup.
// SCOPE: AuthProvider (authenticate on mount), useAuth hook; rendering of states lives in pages/layout.
// DEPENDS: ./auth.js, ../max/bridge.js (webApp), ../api/client.js (apiClient), ../api/mock.js (lazy import under the VITE_USE_MOCK gate only — main.tsx lazy-loads the interceptor the same way, so the mock module stays out of the real-mode runtime); the x-max-init-data header is attached once in main.tsx before render
// LINKS: M-APP-MINIAPP, DF-MAX-IDENTITY
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AuthContextValue - the auth state plus the way a screen writes the user back
// - AuthProvider - resolves the auth state on mount and provides it via context; in mock mode (VITE_USE_MOCK=1) lazily imports the demo user so screens are reachable outside MAX
// - useAuth - read the current AuthState
// END_MODULE_MAP

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { getWebApp } from "../max/bridge";
import { authenticate, type AuthState } from "./auth";

export type AuthContextValue = AuthState & { updateUser: (user: User) => void };

const AuthContext = createContext<AuthContextValue>({ status: "loading", updateUser: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    const demoUser = import.meta.env.VITE_USE_MOCK === "1" ? import("../api/mock").then((module) => module.mockDemoUser) : Promise.resolve(null);
    demoUser
      .then((mockUser) => authenticate(getWebApp(), (payload) => apiClient.login(payload), mockUser))
      .then((resolved) => {
        if (alive) setState(resolved);
      })
      .catch((error) => {
        console.error("Failed to load the auth source", error);
      });
    return () => {
      alive = false;
    };
  }, []);

  const updateUser = useCallback((user: User) => {
    setState((current) => (current.status === "authenticated" ? { ...current, user } : current));
  }, []);

  const value = useMemo((): AuthContextValue => ({ ...state, updateUser }), [state, updateUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
