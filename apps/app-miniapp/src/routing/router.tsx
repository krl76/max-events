// START_MODULE_CONTRACT
// PURPOSE: Minimal router (home / search / map / event / place / friends / calendar / profile / whereto / nearby / discovery / people / plans / organizer / we-groups) synced with window.history, with deep-link resolution from start_param.
// SCOPE: Route type, start_param parsing, history push/replace/popstate sync, back(); no URL path mapping (state-only history entries).
// DEPENDS: ../max/bridge.js (getStartParam, webApp)
// LINKS: M-APP-MINIAPP, DF-MAX-IDENTITY
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - Route - home | search | map | event(id) | place(id) | friends | calendar | profile | settings | whereto | nearby | discovery | people | gathering-new(eventId) | gathering(id) | plans | plan(id) | day-route | list(id) | achievements | micro-new | feed-new(eventId) | organizer | we-groups | we-group(id) | vote(id)
// - routeFromStartParam - map start_param (event-/place-/plan-/list-/gathering-/vote- prefixes) to a Route, home fallback
// - isTabRoute - the five tabbar routes (home/search/map/plans/profile); tab-to-tab switches replace the history entry instead of pushing
// - RouteHistoryState - history entry payload: route + sequential idx (idx drives back/forward detection)
// - nextHistory - pure history decision: tab-to-tab -> replace (idx kept), anything else -> push (idx + 1)
// - routeFromHistoryState - validate a popstate payload back into a RouteHistoryState, null when malformed
// - NavTransition - push/pop/tab/none direction of the last navigation (drives screen animations)
// - transitionFromIdx - direction from history idx movement (forward -> push, backward -> pop, same -> tab)
// - RouteProvider - current route synced with window.history (replaceState seed, popstate listener), back() with home fallback, transition direction + navSeq for screen animations
// - useRoute - current route + navigate + back + canGoBack + transition + navSeq
// END_MODULE_MAP

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getStartParam, webApp } from "../max/bridge";

export type Route = { name: "home" } | { name: "search" } | { name: "map" } | { name: "event"; id: string } | { name: "place"; id: string } | { name: "friends" } | { name: "calendar" } | { name: "profile" } | { name: "settings" } | { name: "whereto" } | { name: "nearby" } | { name: "discovery" } | { name: "people" } | { name: "gathering-new"; eventId: string } | { name: "gathering"; id: string } | { name: "plans" } | { name: "plan"; id: string } | { name: "day-route" } | { name: "list"; id: string } | { name: "achievements" } | { name: "micro-new" } | { name: "feed-new"; eventId: string | null } | { name: "organizer" } | { name: "we-groups" } | { name: "we-group"; id: string } | { name: "vote"; id: string };

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

const TAB_ROUTE_NAMES: ReadonlySet<Route["name"]> = new Set(["home", "search", "map", "plans", "profile"]);

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
    case "search":
    case "map":
    case "friends":
    case "calendar":
    case "profile":
    case "settings":
    case "whereto":
    case "nearby":
    case "discovery":
    case "people":
    case "plans":
    case "day-route":
    case "achievements":
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

export type NavTransition = "push" | "pop" | "tab" | "none";

export function transitionFromIdx(currentIdx: number, nextIdx: number): NavTransition {
  if (nextIdx > currentIdx) return "push";
  if (nextIdx < currentIdx) return "pop";
  return "tab";
}

interface Router {
  route: Route;
  navigate: (route: Route) => void;
  back: () => void;
  canGoBack: boolean;
  transition: NavTransition;
  navSeq: number;
}

const RouteContext = createContext<Router>({ route: { name: "home" }, navigate: () => {}, back: () => {}, canGoBack: false, transition: "none", navSeq: 0 });

function writeHistory(state: RouteHistoryState, method: "push" | "replace"): void {
  if (typeof window === "undefined") return;
  if (method === "replace") window.history.replaceState(state, "");
  else window.history.pushState(state, "");
}

const HOME_STATE: RouteHistoryState = { route: { name: "home" }, idx: 0 };

interface NavState {
  history: RouteHistoryState;
  transition: NavTransition;
  seq: number;
}

export function RouteProvider({ children }: { children: ReactNode }) {
  const [nav, setNav] = useState<NavState>(() => {
    const initial: RouteHistoryState = { route: routeFromStartParam(getStartParam(webApp)), idx: 0 };
    writeHistory(initial, "replace");
    return { history: initial, transition: "none", seq: 0 };
  });

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const next = routeFromHistoryState(event.state) ?? HOME_STATE;
      setNav((current) => ({ history: next, transition: transitionFromIdx(current.history.idx, next.idx), seq: current.seq + 1 }));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback(
    (next: Route) => {
      const { state, method } = nextHistory(nav.history, next);
      writeHistory(state, method);
      setNav({ history: state, transition: method === "push" ? "push" : "tab", seq: nav.seq + 1 });
    },
    [nav],
  );

  const back = useCallback(() => {
    if (nav.history.idx > 0 && typeof window !== "undefined") {
      window.history.back();
      return;
    }
    writeHistory(HOME_STATE, "replace");
    setNav((current) => ({ history: HOME_STATE, transition: "pop", seq: current.seq + 1 }));
  }, [nav.history.idx]);

  const value = useMemo<Router>(() => ({ route: nav.history.route, navigate, back, canGoBack: nav.history.idx > 0, transition: nav.transition, navSeq: nav.seq }), [nav, navigate, back]);
  return <RouteContext.Provider value={value}>{children}</RouteContext.Provider>;
}

export function useRoute(): Router {
  return useContext(RouteContext);
}
