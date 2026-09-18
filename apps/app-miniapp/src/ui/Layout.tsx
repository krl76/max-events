// START_MODULE_CONTRACT
// PURPOSE: Base mini-app layout: MAX UI theme classes, header, content, bottom tabbar with icons.
// SCOPE: Theme application via MAX UI CSS classes, tab navigation between home/plans/friends/calendar/profile; children render routed pages.
// DEPENDS: ../routing/router.js, ../max/bridge.js (webApp), ./theme.css, ./icons.js, @maxhub/max-ui/dist/styles.css (imported in main.tsx)
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - Layout - theme classes + header + routed children + tabbar (icon + label per tab)
// - TABS - tabbar definitions with per-tab active predicate
// END_MODULE_MAP

import { MaxUI } from "@maxhub/max-ui";
import type { ReactNode } from "react";
import { webApp } from "../max/bridge";
import { useRoute } from "../routing/router";
import { TabIconGlyph, type TabIcon } from "./icons";

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

export function Layout({ children }: { children: ReactNode }) {
  const { route, navigate } = useRoute();

  return (
    <MaxUI className="app-root" colorScheme="light" platform={maxUiPlatform()}>
      <header className="app-header">MAX Events</header>
      <main className="app-content">{children}</main>
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
