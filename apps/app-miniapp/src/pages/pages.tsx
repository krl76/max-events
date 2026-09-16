// START_MODULE_CONTRACT
// PURPOSE: Page composition for the shell routing (home feed with whereto CTA, event, friends, calendar, profile, whereto wizard).
// SCOPE: Thin route-to-page mapping; page internals live in their own modules.
// DEPENDS: ../routing/router.js, ../catalog/CatalogPage.js, ../event/EventPage.js, ../friends/FriendsPage.js, ../calendar/CalendarPage.js, ../profile/ProfilePage.js, ../whereto/WheretoPage.js, ../today/TodaySection.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - HomePage - «Куда пойдём?» CTA + today digest (TodaySection) + catalog screen (CatalogPage) on the home route
// - RoutedPages - current page by route; event-<id> deep links render EventPage, friends/calendar/profile routes render their screens, whereto renders the wizard
// END_MODULE_MAP

import { useRoute } from "../routing/router";
import { CatalogPage } from "../catalog/CatalogPage";
import { EventPage } from "../event/EventPage";
import { FriendsPage } from "../friends/FriendsPage";
import { CalendarPage } from "../calendar/CalendarPage";
import { ProfilePage } from "../profile/ProfilePage";
import { WheretoPage } from "../whereto/WheretoPage";
import { TodaySection } from "../today/TodaySection";
import { GatheringFlowPage } from "../gathering/GatheringFlowPage";
import { GatheringStatusPage } from "../gathering/GatheringStatusPage";

export function HomePage() {
  const { navigate } = useRoute();
  return (
    <>
      <button type="button" className="app-whereto-cta" onClick={() => navigate({ name: "whereto" })}>
        Куда пойдём?
      </button>
      <TodaySection />
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
  if (route.name === "gathering-new") return <GatheringFlowPage eventId={route.eventId} />;
  if (route.name === "gathering") return <GatheringStatusPage id={route.id} />;
  return <HomePage />;
}
