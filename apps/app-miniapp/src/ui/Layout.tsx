// START_MODULE_CONTRACT
// PURPOSE: Base mini-app layout: MAX UI theme classes, header, content, bottom tabbar.
// SCOPE: Theme application via MAX UI CSS classes, tab navigation between home/profile; children render routed pages.
// DEPENDS: ../routing/router.js, ../max/bridge.js (webApp), ./theme.css, @maxhub/max-ui/dist/styles.css (imported in main.tsx)
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - Layout - theme classes + header + routed children + tabbar
// END_MODULE_MAP

import type { ReactNode } from "react";
import { webApp } from "../max/bridge";
import { useRoute } from "../routing/router";

/* MAX Bridge не отдаёт themeParams (сверено с dev.max.ru/docs/webapps/bridge) и
 * различает только ios/android/desktop/web — платформенный класс MAX UI существует
 * для ios/android, остальные клиенты используем мобильную сетку ios. Светлая схема —
 * единственный документированный вариант до появления theme API у платформы. */
function maxUiPlatformClass(): string {
  return webApp?.platform === "android" ? "MaxUI_platform_android" : "MaxUI_platform_ios";
}

export function Layout({ children }: { children: ReactNode }) {
  const { route, navigate } = useRoute();

  return (
    <div className={`app-root MaxUI MaxUI_colorScheme_light ${maxUiPlatformClass()}`}>
      <header className="app-header">MAX Events</header>
      <main className="app-content">{children}</main>
      <nav className="app-tabbar">
        <button type="button" aria-current={route.name === "home" ? "page" : undefined} onClick={() => navigate({ name: "home" })}>
          Лента
        </button>
        <button type="button" aria-current={route.name === "profile" ? "page" : undefined} onClick={() => navigate({ name: "profile" })}>
          Профиль
        </button>
      </nav>
    </div>
  );
}
