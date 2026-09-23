// START_MODULE_CONTRACT
// PURPOSE: Base mini-app layout: header (home: wordmark; other routes: per-route title + back button), content, bottom tabbar with icons.
// SCOPE: Tab navigation between home/search/create/plans/profile (макет, экраны 03 и 08); children render routed pages. The organizer contour carries its own bar in ../organizer/OrganizerSpace.tsx.
// DEPENDS: ../routing/router.js, ./theme.css, ./icons.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - Layout - header + routed children + tabbar (icon + label per tab)
// - TABS - tabbar definitions with per-tab active predicate; the map belongs to the Поиск tab, because it is a view inside search (экран 16)
// - ROUTE_TITLES - header title per route name (tab routes keep their tab labels)
// - routeTitle - header title for the current route
// - routeHasBack - back button shown on every non-tab route, the map included
// - routeHasHeader - header hidden on the search/plans/profile tab screens (profile renders its own Instagram-style topbar)
// END_MODULE_MAP

import type { ReactNode } from "react";
import { isTabRoute, useRoute, type Route } from "../routing/router";
import { ActionIcon, TabIconGlyph, type TabIcon } from "./icons";

export const TABS: Array<{ icon: TabIcon; label: string; active: (route: string) => boolean; route: "home" | "search" | "create" | "plans" | "profile" }> = [
  { icon: "feed", label: "Лента", route: "home", active: (name) => name === "home" },
  { icon: "search", label: "Поиск", route: "search", active: (name) => name === "search" || name === "map" },
  { icon: "create", label: "Создать", route: "create", active: (name) => name === "create" || name === "story-new" || name === "feed-new" || name === "micro-new" || name === "plan-new" },
  { icon: "plans", label: "Планы", route: "plans", active: (name) => name === "plans" || name === "plan" || name === "day-route" || name === "calendar" || name === "list" },
  { icon: "profile", label: "Профиль", route: "profile", active: (name) => name === "profile" || name === "friends" || name === "subscriptions" },
];

export const ROUTE_TITLES: Record<Route["name"], string> = {
  home: "Лента",
  search: "Поиск",
  create: "Создать",
  map: "Карта",
  plans: "Планы",
  friends: "Друзья",
  calendar: "Календарь",
  profile: "Профиль",
  settings: "Настройки",
  subscriptions: "Подписки",
  event: "Событие",
  place: "Место",
  whereto: "Куда пойдём?",
  nearby: "Рядом со мной",
  discovery: "Подборка мест",
  people: "Похожие люди",
  "gathering-new": "Сбор компании",
  gathering: "Сбор компании",
  plan: "План",
  "plan-new": "Свой план",
  "day-route": "Маршрут на день",
  list: "Список",
  achievements: "Достижения",
  "micro-new": "Новое микро-событие",
  "story-new": "Новая история",
  "feed-new": "Новое впечатление",
  organizer: "Панель организатора",
  "we-groups": "Группы «Мы»",
  "we-group": "Группа «Мы»",
  vote: "Голосование",
  moderation: "Жалобы",
};

export function routeTitle(route: Route): string {
  return ROUTE_TITLES[route.name];
}

export function routeHasBack(route: Route): boolean {
  return !isTabRoute(route.name);
}

// The map keeps its header: since it stopped being a tab it is reached from Поиск, and a pushed screen needs its back button.
const HEADERLESS_ROUTES: ReadonlySet<Route["name"]> = new Set(["search", "plans", "profile"]);

export function routeHasHeader(route: Route): boolean {
  return !HEADERLESS_ROUTES.has(route.name);
}

export function Layout({ children }: { children: ReactNode }) {
  const { route, navigate, back, transition, navSeq } = useRoute();

  return (
    <>
      {routeHasHeader(route) && (
        <header className="app-header">
          {route.name === "home" ? (
            <span className="app-header-wordmark">MAX Events</span>
          ) : (
            <>
              {routeHasBack(route) && (
                <button type="button" className="app-header-back" aria-label="Назад" onClick={back}>
                  {/* 24px: навигационная иконка, как у таббара (20px — размер для списков) */}
                  <ActionIcon name="chevron" size={24} strokeWidth={2} />
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
    </>
  );
}
