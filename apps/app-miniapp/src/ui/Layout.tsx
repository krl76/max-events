// START_MODULE_CONTRACT
// PURPOSE: Base mini-app layout: header (home: wordmark + search; other routes: per-route title + back button), content, bottom tabbar with icons.
// SCOPE: Tab navigation between home/search/map/plans/profile; children render routed pages; the home search query lives in HomeSearchContext for the catalog to consume.
// DEPENDS: ../routing/router.js, ./theme.css, ./icons.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - Layout - header + routed children + tabbar (icon + label per tab)
// - TABS - tabbar definitions with per-tab active predicate
// - ROUTE_TITLES - header title per route name (tab routes keep their tab labels)
// - routeTitle - header title for the current route
// - routeHasBack - back button shown on every non-tab route
// - routeHasHeader - header hidden on the search/map/plans tab screens
// - HomeSearchContext - home header search query ("" when inactive)
// - useHomeSearch - read/update the home search query
// END_MODULE_MAP

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { isTabRoute, useRoute, type Route } from "../routing/router";
import { ActionIcon, TabIconGlyph, type TabIcon } from "./icons";

export const TABS: Array<{ icon: TabIcon; label: string; active: (route: string) => boolean; route: "home" | "search" | "map" | "plans" | "profile" }> = [
  { icon: "feed", label: "Лента", route: "home", active: (name) => name === "home" },
  { icon: "search", label: "Поиск", route: "search", active: (name) => name === "search" },
  { icon: "map", label: "Карта", route: "map", active: (name) => name === "map" },
  { icon: "plans", label: "Моё", route: "plans", active: (name) => name === "plans" || name === "plan" || name === "day-route" || name === "calendar" || name === "list" },
  { icon: "profile", label: "Профиль", route: "profile", active: (name) => name === "profile" || name === "friends" },
];

export const ROUTE_TITLES: Record<Route["name"], string> = {
  home: "Лента",
  search: "Поиск",
  map: "Карта",
  plans: "Моё",
  friends: "Друзья",
  calendar: "Календарь",
  profile: "Профиль",
  event: "Событие",
  place: "Место",
  whereto: "Куда пойдём?",
  nearby: "Рядом со мной",
  discovery: "Подборка мест",
  people: "Похожие люди",
  "gathering-new": "Сбор компании",
  gathering: "Сбор компании",
  plan: "План",
  "day-route": "Маршрут на день",
  list: "Список",
  achievements: "Достижения",
  "micro-new": "Новое микро-событие",
  "feed-new": "Новое впечатление",
  organizer: "Панель организатора",
  "we-groups": "Группы «Мы»",
  "we-group": "Группа «Мы»",
  vote: "Голосование",
};

export function routeTitle(route: Route): string {
  return ROUTE_TITLES[route.name];
}

export function routeHasBack(route: Route): boolean {
  return !isTabRoute(route.name);
}

const HEADERLESS_ROUTES: ReadonlySet<Route["name"]> = new Set(["search", "map", "plans"]);

export function routeHasHeader(route: Route): boolean {
  return !HEADERLESS_ROUTES.has(route.name);
}

interface HomeSearch {
  query: string;
  setQuery: (query: string) => void;
}

export const HomeSearchContext = createContext<HomeSearch>({ query: "", setQuery: () => {} });

export function useHomeSearch(): HomeSearch {
  return useContext(HomeSearchContext);
}

export function Layout({ children }: { children: ReactNode }) {
  const { route, navigate, back, transition, navSeq } = useRoute();
  const [query, setQuery] = useState("");
  const search = useMemo<HomeSearch>(() => ({ query, setQuery }), [query]);

  return (
    <HomeSearchContext.Provider value={search}>
      {routeHasHeader(route) && (
        <header className="app-header">
          {route.name === "home" ? (
            <>
              <span className="app-header-wordmark">MAX Events</span>
              <label className="app-header-search">
                <ActionIcon name="search" size={16} />
                <input type="search" placeholder="Поиск" aria-label="Поиск" value={query} onChange={(change) => setQuery(change.target.value)} />
              </label>
            </>
          ) : (
            <>
              {routeHasBack(route) && (
                <button type="button" className="app-header-back" aria-label="Назад" onClick={back}>
                  <ActionIcon name="chevron" size={20} strokeWidth={2} />
                </button>
              )}
              <span className="app-header-title">{routeTitle(route)}</span>
            </>
          )}
        </header>
      )}
      <main key={navSeq} className={`app-content app-screen--${transition}${route.name === "map" ? " app-content--flush" : ""}`}>
        {children}
      </main>
      <nav className="app-tabbar">
        {TABS.map((tab) => (
          <button key={tab.route} type="button" aria-current={tab.active(route.name) ? "page" : undefined} onClick={() => navigate({ name: tab.route })}>
            <TabIconGlyph name={tab.icon} size={24} filled={tab.active(route.name)} />
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </HomeSearchContext.Provider>
  );
}
