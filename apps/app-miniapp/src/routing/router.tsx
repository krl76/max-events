// START_MODULE_CONTRACT
// PURPOSE: Minimal router (home / event / place / friends / calendar / profile / whereto / nearby / discovery / people / plans / lists / organizer / we-groups) synced with window.history, with deep-link resolution from start_param.
// SCOPE: Route type, start_param parsing, history push/replace/popstate sync, back(); no URL path mapping (state-only history entries).
// DEPENDS: ../max/bridge.js (getStartParam, webApp)
// LINKS: M-APP-MINIAPP, DF-MAX-IDENTITY
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - Route - home | event(id) | place(id) | friends | calendar | profile | whereto | nearby | discovery | people | gathering-new(eventId) | gathering(id) | plans | plan(id) | day-route | lists | list(id) | achievements | my-city | micro-new | feed-new(eventId) | organizer | we-groups | we-group(id) | vote(id)
// - routeFromStartParam - map start_param (event-/place-/plan-/list-/gathering-/vote- prefixes) to a Route, home fallback
// - isTabRoute - the five tabbar routes; tab-to-tab switches replace the history entry instead of pushing
// - nextHistory - pure history decision: tab-to-tab -> replace (idx kept), anything else -> push (idx + 1)
// - routeFromHistoryState - validate a popstate payload back into a RouteHistoryState, null when malformed
// - RouteProvider - current route synced with window.history (replaceState seed, popstate listener), back() with home fallback
// - useRoute - current route + navigate + back + canGoBack
// END_MODULE_MAP

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getStartParam, webApp } from "../max/bridge";

export type Route = { name: "home" } | { name: "event"; id: string } | { name: "place"; id: string } | { name: "friends" } | { name: "calendar" } | { name: "profile" } | { name: "whereto" } | { name: "nearby" } | { name: "discovery" } | { name: "people" } | { name: "gathering-new"; eventId: string } | { name: "gathering"; id: string } | { name: "plans" } | { name: "plan"; id: string } | { name: "day-route" } | { name: "lists" } | { name: "list"; id: string } | { name: "achievements" } | { name: "my-city" } | { name: "micro-new" } | { name: "feed-new"; eventId: string | null } | { name: "organizer" } | { name: "we-groups" } | { name: "we-group"; id: string } | { name: "vote"; id: string };

const START_PARAM_PREFIXES = [
  ["event-", "event"],
  ["place-", "place"],
  ["plan-", "plan"],
  ["list-", "list"],
  ["gathering-", "gathering"],
  ["vote-", "vote"],
] as const satisfies ReadonlyArray<readonly [string, Route["name"]]>;

export function routeFromStartParam(startParam: string | null): Route {
  for (const [prefix, name] of START_PARAM_PREFIXES) {
    if (startParam?.startsWith(prefix)) {
      const id = startParam.slice(prefix.length);
      if (id) return { name, id } as Route;
    }
  }
  return { name: "home" };
}

const TAB_ROUTE_NAMES: ReadonlySet<Route["name"]> = new Set(["home", "plans", "friends", "calendar", "profile"]);

export function isTabRoute(name: Route["name"]): boolean {
  return TAB_ROUTE_NAMES.has(name);
}

export interface RouteHistoryState {
  route: Route;
  idx: number;
}

export function nextHistory(current: RouteHistoryState, next: Route): { state: RouteHistoryState; method: "push" | "replace" } {
  if (isTabRoute(current.route.name) && isTabRoute(next.name)) {
    return { state: { route: next, idx: current.idx }, method: "replace" };
  }
  return { state: { route: next, idx: current.idx + 1 }, method: "push" };
}

function toRoute(value: unknown): Route | null {
  if (typeof value !== "object" || value === null) return null;
  const { name } = value as { name?: unknown };
  if (typeof name !== "string") return null;
  switch (name) {
    case "home":
    case "friends":
    case "calendar":
    case "profile":
    case "whereto":
    case "nearby":
    case "discovery":
    case "people":
    case "plans":
    case "day-route":
    case "lists":
    case "achievements":
    case "my-city":
    case "micro-new":
    case "organizer":
    case "we-groups":
      return { name };
    case "feed-new": {
      const { eventId } = value as { eventId?: unknown };
      if (eventId !== null && eventId !== undefined && typeof eventId !== "string") return null;
      return { name, eventId: eventId ?? null };
    }
    case "gathering-new": {
      const { eventId } = value as { eventId?: unknown };
      return typeof eventId === "string" ? { name, eventId } : null;
    }
    case "event":
    case "place":
    case "gathering":
    case "plan":
    case "list":
    case "we-group":
    case "vote": {
      const { id } = value as { id?: unknown };
      return typeof id === "string" ? ({ name, id } as Route) : null;
    }
    default:
      return null;
  }
}

export function routeFromHistoryState(value: unknown): RouteHistoryState | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as { route?: unknown; idx?: unknown };
  if (typeof candidate.idx !== "number") return null;
  const route = toRoute(candidate.route);
  return route === null ? null : { route, idx: candidate.idx };
}

interface Router {
  route: Route;
  navigate: (route: Route) => void;
  back: () => void;
  canGoBack: boolean;
}

const RouteContext = createContext<Router>({ route: { name: "home" }, navigate: () => {}, back: () => {}, canGoBack: false });

function writeHistory(state: RouteHistoryState, method: "push" | "replace"): void {
  if (typeof window === "undefined") return;
  if (method === "replace") window.history.replaceState(state, "");
  else window.history.pushState(state, "");
}

const HOME_STATE: RouteHistoryState = { route: { name: "home" }, idx: 0 };

export function RouteProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<RouteHistoryState>(() => {
    const initial: RouteHistoryState = { route: routeFromStartParam(getStartParam(webApp)), idx: 0 };
    writeHistory(initial, "replace");
    return initial;
  });

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      setHistory(routeFromHistoryState(event.state) ?? HOME_STATE);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback(
    (next: Route) => {
      const { state, method } = nextHistory(history, next);
      writeHistory(state, method);
      setHistory(state);
    },
    [history],
  );

  const back = useCallback(() => {
    if (history.idx > 0 && typeof window !== "undefined") {
      window.history.back();
      return;
    }
    writeHistory(HOME_STATE, "replace");
    setHistory(HOME_STATE);
  }, [history.idx]);

  const value = useMemo<Router>(() => ({ route: history.route, navigate, back, canGoBack: history.idx > 0 }), [history, navigate, back]);
  return <RouteContext.Provider value={value}>{children}</RouteContext.Provider>;
}

export function useRoute(): Router {
  return useContext(RouteContext);
}
