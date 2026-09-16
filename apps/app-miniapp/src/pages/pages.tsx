// START_MODULE_CONTRACT
// PURPOSE: Page composition for the shell routing (home feed with whereto CTA, event, friends, calendar, profile, whereto wizard, plans).
// SCOPE: Thin route-to-page mapping; page internals live in their own modules.
// DEPENDS: ../routing/router.js, ../catalog/CatalogPage.js, ../event/EventPage.js, ../friends/FriendsPage.js, ../calendar/CalendarPage.js, ../profile/ProfilePage.js, ../whereto/WheretoPage.js, ../today/TodaySection.js, ../plans/PlansPage.js, ../plans/PlanPage.js, ../micro/MicroEvents.js, ../feed/FeedPage.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - HomePage - «Куда пойдём?» CTA + today digest (TodaySection) + impressions feed (FeedSection) + micro-events section (MicroSection) + catalog screen (CatalogPage) on the home route; today block hidden in map view so the map gets the viewport
// - RoutedPages - current page by route; event-<id> deep links render EventPage, friends/calendar/profile routes render their screens (profile + achievements/my-city/lists entries), whereto renders the wizard, micro-new renders the micro-event creation form, feed-new renders the impression publish form, plans renders the plans list and plan(id) the plan screen, lists renders the saved lists and list(id) one list
// END_MODULE_MAP

import { useState } from "react";
import { useRoute } from "../routing/router";
import { CatalogPage, type CatalogViewName } from "../catalog/CatalogPage";
import { EventPage } from "../event/EventPage";
import { FriendsPage } from "../friends/FriendsPage";
import { CalendarPage } from "../calendar/CalendarPage";
import { ProfilePage } from "../profile/ProfilePage";
import { WheretoPage } from "../whereto/WheretoPage";
import { TodaySection } from "../today/TodaySection";
import { GatheringFlowPage } from "../gathering/GatheringFlowPage";
import { GatheringStatusPage } from "../gathering/GatheringStatusPage";
import { PlansPage } from "../plans/PlansPage";
import { PlanPage } from "../plans/PlanPage";
import { ListPage, ListsLink, ListsPage } from "../lists/ListsPage";
import { AchievementsLink, AchievementsPage } from "../profile/AchievementsPage";
import { MyCityLink, MyCityPage } from "../profile/MyCityPage";
import { MicroEventCreatePage, MicroSection } from "../micro/MicroEvents";
import { FeedCreatePage, FeedSection } from "../feed/FeedPage";

export function HomePage() {
  const { navigate } = useRoute();
  const [view, setView] = useState<CatalogViewName>("list");
  return (
    <>
      {view === "list" && (
        <>
          <button type="button" className="app-whereto-cta" onClick={() => navigate({ name: "whereto" })}>
            Куда пойдём?
          </button>
          <FeedSection onCreate={() => navigate({ name: "feed-new", eventId: null })} />
          <TodaySection />
          <MicroSection onCreate={() => navigate({ name: "micro-new" })} />
        </>
      )}
      <CatalogPage view={view} onView={setView} />
    </>
  );
}

export function RoutedPages() {
  const { route } = useRoute();

  if (route.name === "event") return <EventPage id={route.id} />;
  if (route.name === "friends") return <FriendsPage />;
  if (route.name === "calendar") return <CalendarPage />;
  if (route.name === "profile")
    return (
      <>
        <ProfilePage />
        <AchievementsLink />
        <MyCityLink />
        <ListsLink />
      </>
    );
  if (route.name === "lists") return <ListsPage />;
  if (route.name === "list") return <ListPage id={route.id} />;
  if (route.name === "achievements") return <AchievementsPage />;
  if (route.name === "my-city") return <MyCityPage />;
  if (route.name === "whereto") return <WheretoPage />;
  if (route.name === "micro-new") return <MicroEventCreatePage />;
  if (route.name === "feed-new") return <FeedCreatePage eventId={route.eventId} />;
  if (route.name === "gathering-new") return <GatheringFlowPage eventId={route.eventId} />;
  if (route.name === "gathering") return <GatheringStatusPage id={route.id} />;
  if (route.name === "plans") return <PlansPage />;
  if (route.name === "plan") return <PlanPage id={route.id} />;
  return <HomePage />;
}
