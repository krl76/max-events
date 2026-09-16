// START_MODULE_CONTRACT
// PURPOSE: Page composition for the shell routing (home feed, event, profile).
// SCOPE: Thin route-to-page mapping; page internals live in their own modules.
// DEPENDS: ../auth/AuthContext.js, ../routing/router.js, ../catalog/CatalogPage.js, ../event/EventPage.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - HomePage - catalog screen (CatalogPage) rendered on the home route
// - ProfilePage - profile placeholder reflecting auth state
// - RoutedPages - current page by route; event-<id> deep links render EventPage from ../event/EventPage.js
// END_MODULE_MAP

import { useAuth } from "../auth/AuthContext";
import { useRoute } from "../routing/router";
import { CatalogPage } from "../catalog/CatalogPage";
import { EventPage } from "../event/EventPage";

export function HomePage() {
  return <CatalogPage />;
}

export function ProfilePage() {
  const auth = useAuth();

  if (auth.status === "authenticated") {
    return (
      <article className="app-card">
        <div className="app-card-body">
          <span className="app-card-title">{auth.user.firstName}</span>
          <span className="app-card-subtitle">Профиль</span>
        </div>
      </article>
    );
  }
  if (auth.status === "error") {
    return <p className="app-state app-state--error">Не удалось войти: {auth.message}</p>;
  }
  if (auth.status === "loading") {
    return <p className="app-state">Загрузка…</p>;
  }
  return <p className="app-state">Откройте приложение внутри MAX, чтобы авторизоваться.</p>;
}

export function RoutedPages() {
  const { route } = useRoute();

  if (route.name === "event") return <EventPage id={route.id} />;
  if (route.name === "profile") return <ProfilePage />;
  return <HomePage />;
}
