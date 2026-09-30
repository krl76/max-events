// START_MODULE_CONTRACT
// PURPOSE: React context exposing the AuthState resolved once at startup.
// SCOPE: AuthProvider (authenticate on mount), useAuth hook; rendering of states lives in pages/layout.
// DEPENDS: ./auth.js, ../max/bridge.js (webApp), ../api/client.js (apiClient), ../api/mock.js (lazy import under the VITE_USE_MOCK gate only — main.tsx lazy-loads the interceptor the same way, so the mock module stays out of the real-mode runtime); the x-max-init-data header is attached once in main.tsx before render
// LINKS: M-APP-MINIAPP, DF-MAX-IDENTITY
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AuthContextValue - the auth state plus the way a screen writes the user back and re-runs a failed login
// - AuthProvider - resolves the auth state on mount (and on retry) and provides it via context; in mock mode (VITE_USE_MOCK=1) lazily imports the demo user so screens are reachable outside MAX
// - useAuth - read the current AuthState
// END_MODULE_MAP

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@max-events/api-contracts";
import { apiClient } from "../api/client";
import { getWebApp } from "../max/bridge";
import { authenticate, waitForInitData, type AuthState } from "./auth";

export type AuthContextValue = AuthState & { updateUser: (user: User) => void; retry: () => void };

const AuthContext = createContext<AuthContextValue>({ status: "loading", updateUser: () => {}, retry: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    const demoUser = import.meta.env.VITE_USE_MOCK === "1" ? import("../api/mock").then((module) => module.mockDemoUser) : Promise.resolve(null);
    demoUser
      .then(async (mockUser) => {
        const initData = await waitForInitData(
          () => getWebApp()?.initData,
          () => getWebApp() !== null,
        );
        if (initData) apiClient.setInitData(initData);
        const login = (payload: { initData: string }) => apiClient.login(payload);
        let resolved = await authenticate(initData ? { initData } : getWebApp(), login, mockUser);
        if (resolved.status === "error") {
          const again = getWebApp()?.initData?.trim() ?? "";
          if (again && again !== initData) {
            apiClient.setInitData(again);
            resolved = await authenticate({ initData: again }, login, mockUser);
          }
        }
        return resolved;
      })
      .then((resolved) => {
        if (alive) setState(resolved);
      })
      .catch((error) => {
        console.error("Failed to load the auth source", error);
        if (alive) setState({ status: "error", message: error instanceof Error ? error.message : "auth failed" });
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const updateUser = useCallback((user: User) => {
    setState((current) => (current.status === "authenticated" ? { ...current, user } : current));
  }, []);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  const value = useMemo((): AuthContextValue => ({ ...state, updateUser, retry }), [state, updateUser, retry]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
