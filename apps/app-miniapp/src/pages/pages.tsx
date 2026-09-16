// START_MODULE_CONTRACT
// PURPOSE: Placeholder pages (home feed, event, profile) for the shell routing.
// SCOPE: Static placeholders driven by theme tokens; real data arrives in later feed/event tasks.
// DEPENDS: ../auth/AuthContext.js, ../routing/router.js, ../catalog/CatalogPage.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - HomePage - catalog screen (CatalogPage) rendered on the home route
// - EventPage - large media placeholder for event-<id> deep links
// - ProfilePage - profile placeholder reflecting auth state
// - RoutedPages - current page by route
// END_MODULE_MAP

import { useAuth } from "../auth/AuthContext";
import { useRoute } from "../routing/router";
import { CatalogPage } from "../catalog/CatalogPage";

export function HomePage() {
  return <CatalogPage />;
}

export function EventPage({ id }: { id: string }) {
  return (
    <article className="app-card">
      <div className="app-card-media" />
      <div className="app-card-body">
        <span className="app-card-title">Событие {id}</span>
        <span className="app-card-subtitle">Открыто по deep-link</span>
      </div>
    </article>
  );
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
