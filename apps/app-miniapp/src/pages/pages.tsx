// START_MODULE_CONTRACT
// PURPOSE: Page composition for the shell routing (home feed with whereto CTA, event, friends, calendar, profile, whereto wizard).
// SCOPE: Thin route-to-page mapping; page internals live in their own modules.
// DEPENDS: ../routing/router.js, ../catalog/CatalogPage.js, ../event/EventPage.js, ../friends/FriendsPage.js, ../calendar/CalendarPage.js, ../profile/ProfilePage.js, ../whereto/WheretoPage.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - HomePage - «Куда пойдём?» CTA + catalog screen (CatalogPage) on the home route
// - RoutedPages - current page by route; event-<id> deep links render EventPage, friends/calendar/profile routes render their screens, whereto renders the wizard
// END_MODULE_MAP

import { useRoute } from "../routing/router";
import { CatalogPage } from "../catalog/CatalogPage";
import { EventPage } from "../event/EventPage";
import { FriendsPage } from "../friends/FriendsPage";
import { CalendarPage } from "../calendar/CalendarPage";
import { ProfilePage } from "../profile/ProfilePage";
import { WheretoPage } from "../whereto/WheretoPage";

export function HomePage() {
  const { navigate } = useRoute();
  return (
    <>
      <button type="button" className="app-whereto-cta" onClick={() => navigate({ name: "whereto" })}>
        Куда пойдём?
      </button>
      <CatalogPage />
    </>
  );
}

export function RoutedPages() {
  const { route } = useRoute();

  if (route.name === "event") return <EventPage id={route.id} />;
  if (route.name === "friends") return <FriendsPage />;
  if (route.name === "calendar") return <CalendarPage />;
  if (route.name === "profile") return <ProfilePage />;
  if (route.name === "whereto") return <WheretoPage />;
  return <HomePage />;
}
