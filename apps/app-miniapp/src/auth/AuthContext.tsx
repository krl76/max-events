// START_MODULE_CONTRACT
// PURPOSE: React context exposing the AuthState resolved once at startup.
// SCOPE: AuthProvider (authenticate on mount), useAuth hook; rendering of states lives in pages/layout.
// DEPENDS: ./auth.js, ../max/bridge.js (webApp), ../api/client.js (apiClient)
// LINKS: M-APP-MINIAPP, DF-MAX-IDENTITY
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AuthProvider - resolves the auth state on mount and provides it via context
// - useAuth - read the current AuthState
// END_MODULE_MAP

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiClient } from "../api/client";
import { webApp } from "../max/bridge";
import { authenticate, type AuthState } from "./auth";

const AuthContext = createContext<AuthState>({ status: "loading" });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    authenticate(webApp, (payload) => apiClient.login(payload)).then((resolved) => {
      if (alive) setState(resolved);
    });
    return () => {
      alive = false;
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
