// START_MODULE_CONTRACT
// PURPOSE: Minimal state-based router (home / event / place / friends / calendar / profile / whereto / nearby / discovery / people / plans / lists / organizer / we-groups) with deep-link resolution from start_param.
// SCOPE: Route type, start_param parsing, RouteProvider + useRoute; no URL/history integration.
// DEPENDS: ../max/bridge.js (getStartParam, webApp)
// LINKS: M-APP-MINIAPP, DF-MAX-IDENTITY
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - Route - home | event(id) | place(id) | friends | calendar | profile | whereto | nearby | discovery | people | gathering-new(eventId) | gathering(id) | plans | plan(id) | day-route | lists | list(id) | achievements | my-city | micro-new | feed-new(eventId) | organizer | we-groups | we-group(id) | vote(id)
// - routeFromStartParam - map start_param (event-/place-/plan-/list-/gathering-/vote- prefixes) to a Route, home fallback
// - RouteProvider - holds the current route, initial route from start_param
// - useRoute - current route + navigate
// END_MODULE_MAP

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
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

interface Router {
  route: Route;
  navigate: (route: Route) => void;
}

const RouteContext = createContext<Router>({ route: { name: "home" }, navigate: () => {} });

export function RouteProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>(() => routeFromStartParam(getStartParam(webApp)));
  const value = useMemo(() => ({ route, navigate: setRoute }), [route]);
  return <RouteContext.Provider value={value}>{children}</RouteContext.Provider>;
}

export function useRoute(): Router {
  return useContext(RouteContext);
}
