// START_MODULE_CONTRACT
// PURPOSE: Base mini-app layout: MAX UI theme classes, header (per-route title + back button on detail routes), content, bottom tabbar with icons.
// SCOPE: Theme application via MAX UI CSS classes, tab navigation between home/plans/friends/calendar/profile; children render routed pages.
// DEPENDS: ../routing/router.js, ../max/bridge.js (webApp), ./theme.css, ./icons.js, @maxhub/max-ui/dist/styles.css (imported in main.tsx)
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - Layout - theme classes + header + routed children + tabbar (icon + label per tab)
// - TABS - tabbar definitions with per-tab active predicate
// - ROUTE_TITLES - header title per route name (tab routes keep their tab labels)
// - routeTitle / routeHasBack - header derivation from the current route (back on every non-tab route)
// END_MODULE_MAP

import { MaxUI } from "@maxhub/max-ui";
import type { ReactNode } from "react";
import { webApp } from "../max/bridge";
import { isTabRoute, useRoute, type Route } from "../routing/router";
import { ActionIcon, TabIconGlyph, type TabIcon } from "./icons";

/* MAX Bridge не отдаёт themeParams (сверено с dev.max.ru/docs/webapps/bridge) и
 * различает только ios/android/desktop/web — платформенный класс MAX UI существует
 * для ios/android, остальные клиенты используем мобильную сетку ios. Светлая схема —
 * единственный документированный вариант до появления theme API у платформы. */
function maxUiPlatform(): "android" | "ios" {
  return webApp?.platform === "android" ? "android" : "ios";
}

export const TABS: Array<{ icon: TabIcon; label: string; active: (route: string) => boolean; route: "home" | "plans" | "friends" | "calendar" | "profile" }> = [
  { icon: "feed", label: "Лента", route: "home", active: (name) => name === "home" },
  { icon: "plans", label: "Планы", route: "plans", active: (name) => name === "plans" || name === "plan" || name === "day-route" },
  { icon: "friends", label: "Друзья", route: "friends", active: (name) => name === "friends" },
  { icon: "calendar", label: "Календарь", route: "calendar", active: (name) => name === "calendar" },
  { icon: "profile", label: "Профиль", route: "profile", active: (name) => name === "profile" },
];

export const ROUTE_TITLES: Record<Route["name"], string> = {
  home: "Лента",
  plans: "Планы",
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
  lists: "Сохранённое",
  list: "Список",
  achievements: "Достижения",
  "my-city": "Мой город",
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

export function Layout({ children }: { children: ReactNode }) {
  const { route, navigate, back, transition, navSeq } = useRoute();

  return (
    <MaxUI className="app-root" colorScheme="light" platform={maxUiPlatform()}>
      <header className="app-header">
        {routeHasBack(route) && (
          <button type="button" className="app-header-back" aria-label="Назад" onClick={back}>
            <ActionIcon name="chevron" size={20} strokeWidth={2} />
          </button>
        )}
        <span className="app-header-title">{routeTitle(route)}</span>
      </header>
      <main key={navSeq} className={`app-content app-screen--${transition}`}>
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
    </MaxUI>
  );
}
