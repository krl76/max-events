// START_MODULE_CONTRACT
// PURPOSE: Page composition for the shell routing (home feed with whereto/nearby CTAs, event, place, friends with the discovery/people entries, calendar, profile, whereto wizard, nearby screen, reverse discovery, people matching, plans, day route builder).
// SCOPE: Thin route-to-page mapping; page internals live in their own modules.
// DEPENDS: ../routing/router.js, ../catalog/CatalogPage.js, ../event/EventPage.js, ../place/PlacePage.js, ../friends/FriendsPage.js, ../calendar/CalendarPage.js, ../profile/ProfilePage.js, ../whereto/WheretoPage.js, ../nearby/NearbyPage.js, ../discovery/DiscoveryPage.js, ../people/PeoplePage.js, ../today/TodaySection.js, ../assist/AssistSection.js, ../plans/PlansPage.js, ../plans/PlanPage.js, ../route/DayRoutePage.js, ../micro/MicroEvents.js, ../feed/FeedPage.js, ../organizer/OrganizerPage.js, ../promo/PromoSections.js, ../wegroup/WeGroupsPage.js, ../wegroup/WeGroupPage.js, ../votes/VotePage.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - HomePage - stories rail (StoriesRow) + «Куда пойдём?»/«Рядом со мной» CTA pair (primary/secondary) + NL assist section (AssistSection) + today digest (TodaySection) + impressions feed (FeedSection) + micro-events section (MicroSection) + promotion banners/collections (PromotionSections, #205) + catalog screen (CatalogPage) on the home route; all sections hidden in map view so the map gets the viewport
// - RoutedPages - current page by route; event-<id> deep links render EventPage, place(id) renders PlacePage, friends renders the friends feed with the discovery/people entry buttons, calendar/profile routes render their screens (profile + achievements/my-city/lists/organizer entries), whereto renders the wizard, nearby renders the nearby timeline/leisure screen, discovery renders the reverse discovery screen, people renders the people matching screen, micro-new renders the micro-event creation form, feed-new renders the impression publish form, plans renders the plans list and plan(id) the plan screen, we-groups renders the we-groups list and we-group(id) one we-group, day-route renders the day route builder, lists renders the saved lists and list(id) one list, organizer renders the organizer panel, vote(id) renders the shared vote screen
// END_MODULE_MAP

import { useState } from "react";
import { useRoute } from "../routing/router";
import { CatalogPage, type CatalogViewName } from "../catalog/CatalogPage";
import { EventPage } from "../event/EventPage";
import { PlacePage } from "../place/PlacePage";
import { FriendsPage } from "../friends/FriendsPage";
import { CalendarPage } from "../calendar/CalendarPage";
import { ProfilePage } from "../profile/ProfilePage";
import { WheretoPage } from "../whereto/WheretoPage";
import { NearbyPage } from "../nearby/NearbyPage";
import { TodaySection } from "../today/TodaySection";
import { AssistSection } from "../assist/AssistSection";
import { GatheringFlowPage } from "../gathering/GatheringFlowPage";
import { GatheringStatusPage } from "../gathering/GatheringStatusPage";
import { PlansPage } from "../plans/PlansPage";
import { PlanPage } from "../plans/PlanPage";
import { WeGroupPage } from "../wegroup/WeGroupPage";
import { WeGroupsPage } from "../wegroup/WeGroupsPage";
import { DayRoutePage } from "../route/DayRoutePage";
import { ListPage, ListsLink, ListsPage } from "../lists/ListsPage";
import { AchievementsLink, AchievementsPage } from "../profile/AchievementsPage";
import { MyCityLink, MyCityPage } from "../profile/MyCityPage";
import { MicroEventCreatePage, MicroSection } from "../micro/MicroEvents";
import { FeedCreatePage, FeedSection, StoriesRow } from "../feed/FeedPage";
import { DiscoveryLink, DiscoveryPage } from "../discovery/DiscoveryPage";
import { PeopleLink, PeoplePage } from "../people/PeoplePage";
import { PromotionSections } from "../promo/PromoSections";
import { OrganizerLink, OrganizerPage } from "../organizer/OrganizerPage";
import { VotePage } from "../votes/VotePage";

export function HomePage() {
  const { navigate } = useRoute();
  const [view, setView] = useState<CatalogViewName>("list");
  return (
    <>
      {view === "list" && (
        <>
          <StoriesRow />
          <div className="app-home-ctas">
            <button type="button" className="app-whereto-cta" onClick={() => navigate({ name: "whereto" })}>
              Куда пойдём?
            </button>
            <button type="button" className="app-whereto-cta app-whereto-cta--secondary" onClick={() => navigate({ name: "nearby" })}>
              Рядом со мной
            </button>
          </div>
          <AssistSection />
          <TodaySection />
          <FeedSection onCreate={() => navigate({ name: "feed-new", eventId: null })} />
          <MicroSection onCreate={() => navigate({ name: "micro-new" })} />
          <PromotionSections />
        </>
      )}
      <CatalogPage view={view} onView={setView} />
    </>
  );
}

export function RoutedPages() {
  const { route } = useRoute();

  if (route.name === "event") return <EventPage id={route.id} />;
  if (route.name === "place") return <PlacePage id={route.id} />;
  if (route.name === "friends")
    return (
      <>
        <DiscoveryLink />
        <PeopleLink />
        <FriendsPage />
      </>
    );
  if (route.name === "discovery") return <DiscoveryPage />;
  if (route.name === "people") return <PeoplePage />;
  if (route.name === "calendar") return <CalendarPage />;
  if (route.name === "profile")
    return (
      <>
        <ProfilePage />
        <AchievementsLink />
        <MyCityLink />
        <ListsLink />
        <OrganizerLink />
      </>
    );
  if (route.name === "organizer") return <OrganizerPage />;
  if (route.name === "lists") return <ListsPage />;
  if (route.name === "list") return <ListPage id={route.id} />;
  if (route.name === "achievements") return <AchievementsPage />;
  if (route.name === "my-city") return <MyCityPage />;
  if (route.name === "whereto") return <WheretoPage />;
  if (route.name === "nearby") return <NearbyPage />;
  if (route.name === "micro-new") return <MicroEventCreatePage />;
  if (route.name === "feed-new") return <FeedCreatePage eventId={route.eventId} />;
  if (route.name === "gathering-new") return <GatheringFlowPage eventId={route.eventId} />;
  if (route.name === "gathering") return <GatheringStatusPage id={route.id} />;
  if (route.name === "vote") return <VotePage id={route.id} />;
  if (route.name === "plans") return <PlansPage />;
  if (route.name === "plan") return <PlanPage id={route.id} />;
  if (route.name === "we-groups") return <WeGroupsPage />;
  if (route.name === "we-group") return <WeGroupPage id={route.id} />;
  if (route.name === "day-route") return <DayRoutePage />;
  return <HomePage />;
}
