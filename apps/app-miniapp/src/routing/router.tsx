// START_MODULE_CONTRACT
// PURPOSE: Minimal state-based router (home / event / friends / calendar / profile / whereto / plans / lists) with deep-link resolution from start_param.
// SCOPE: Route type, start_param parsing, RouteProvider + useRoute; no URL/history integration.
// DEPENDS: ../max/bridge.js (getStartParam, webApp)
// LINKS: M-APP-MINIAPP, DF-MAX-IDENTITY
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - Route - home | event(id) | friends | calendar | profile | whereto | gathering-new(eventId) | gathering(id) | plans | plan(id) | lists | list(id) | achievements | my-city
// - routeFromStartParam - map start_param (event-*) to a Route, home fallback
// - RouteProvider - holds the current route, initial route from start_param
// - useRoute - current route + navigate
// END_MODULE_MAP

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { getStartParam, webApp } from "../max/bridge";

export type Route = { name: "home" } | { name: "event"; id: string } | { name: "friends" } | { name: "calendar" } | { name: "profile" } | { name: "whereto" } | { name: "gathering-new"; eventId: string } | { name: "gathering"; id: string } | { name: "plans" } | { name: "plan"; id: string } | { name: "lists" } | { name: "list"; id: string } | { name: "achievements" } | { name: "my-city" };

export function routeFromStartParam(startParam: string | null): Route {
  if (startParam?.startsWith("event-")) {
    const id = startParam.slice("event-".length);
    if (id) return { name: "event", id };
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
