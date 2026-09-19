// START_MODULE_CONTRACT
// PURPOSE: Page composition for the shell routing (home feed with whereto/nearby CTAs, event, place, friends with the discovery/people entries, calendar, profile, whereto wizard, nearby screen, reverse discovery, people matching, plans, day route builder).
// SCOPE: Thin route-to-page mapping; page internals live in their own modules.
// DEPENDS: ../routing/router.js, ../catalog/CatalogPage.js, ../event/EventPage.js, ../place/PlacePage.js, ../friends/FriendsPage.js, ../calendar/CalendarPage.js, ../profile/ProfilePage.js, ../whereto/WheretoPage.js, ../nearby/NearbyPage.js, ../discovery/DiscoveryPage.js, ../people/PeoplePage.js, ../today/TodaySection.js, ../assist/AssistSection.js, ../plans/PlansPage.js, ../plans/PlanPage.js, ../route/DayRoutePage.js, ../micro/MicroEvents.js, ../feed/FeedPage.js, ../organizer/OrganizerPage.js, ../promo/PromoSections.js, ../wegroup/WeGroupsPage.js, ../wegroup/WeGroupPage.js, ../votes/VotePage.js, ../ui/primitives.js (AppNavTiles)
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - HomePage - stories rail (StoriesRow) + «Куда пойдём?»/«Рядом со мной» CTA pair (primary/secondary) + NL assist section (AssistSection) + today digest (TodaySection) + impressions feed (FeedSection) + micro-events section (MicroSection) + promotion banners/collections (PromotionSections, #205) + catalog screen (CatalogPage) on the home route; all sections hidden in map view so the map gets the viewport
// - RoutedPages - current page by route; event-<id> deep links render EventPage, place(id) renders PlacePage, friends renders the friends feed with discovery/people nav tiles (AppNavTiles), calendar/profile routes render their screens (profile + achievements/my-city/lists/organizer nav tiles), whereto renders the wizard, nearby renders the nearby timeline/leisure screen, discovery renders the reverse discovery screen, people renders the people matching screen, micro-new renders the micro-event creation form, feed-new renders the impression publish form, plans renders the plans list and plan(id) the plan screen, we-groups renders the we-groups list and we-group(id) one we-group, day-route renders the day route builder, lists renders the saved lists and list(id) one list, organizer renders the organizer panel, vote(id) renders the shared vote screen
// END_MODULE_MAP

import { lazy, Suspense, useState } from "react";
import { useRoute } from "../routing/router";
import { CatalogPage, type CatalogViewName } from "../catalog/CatalogPage";
import { TodaySection } from "../today/TodaySection";
import { AssistSection } from "../assist/AssistSection";
import { PromotionSections } from "../promo/PromoSections";
import { FeedCreatePage, FeedSection, StoriesRow } from "../feed/FeedPage";
import { MicroEventCreatePage, MicroSection } from "../micro/MicroEvents";
import { AppNavTiles, AppSkeleton } from "../ui/primitives";

// ponytail: MicroEventCreatePage/FeedCreatePage share their module with eager home sections, so they stay eager too.
const EventPage = lazy(() => import("../event/EventPage").then((m) => ({ default: m.EventPage })));
const PlacePage = lazy(() => import("../place/PlacePage").then((m) => ({ default: m.PlacePage })));
const FriendsPage = lazy(() => import("../friends/FriendsPage").then((m) => ({ default: m.FriendsPage })));
const DiscoveryPage = lazy(() => import("../discovery/DiscoveryPage").then((m) => ({ default: m.DiscoveryPage })));
const PeoplePage = lazy(() => import("../people/PeoplePage").then((m) => ({ default: m.PeoplePage })));
const CalendarPage = lazy(() => import("../calendar/CalendarPage").then((m) => ({ default: m.CalendarPage })));
const ProfilePage = lazy(() => import("../profile/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const OrganizerPage = lazy(() => import("../organizer/OrganizerPage").then((m) => ({ default: m.OrganizerPage })));
const ListsPage = lazy(() => import("../lists/ListsPage").then((m) => ({ default: m.ListsPage })));
const ListPage = lazy(() => import("../lists/ListsPage").then((m) => ({ default: m.ListPage })));
const AchievementsPage = lazy(() => import("../profile/AchievementsPage").then((m) => ({ default: m.AchievementsPage })));
const MyCityPage = lazy(() => import("../profile/MyCityPage").then((m) => ({ default: m.MyCityPage })));
const WheretoPage = lazy(() => import("../whereto/WheretoPage").then((m) => ({ default: m.WheretoPage })));
const NearbyPage = lazy(() => import("../nearby/NearbyPage").then((m) => ({ default: m.NearbyPage })));
const GatheringFlowPage = lazy(() => import("../gathering/GatheringFlowPage").then((m) => ({ default: m.GatheringFlowPage })));
const GatheringStatusPage = lazy(() => import("../gathering/GatheringStatusPage").then((m) => ({ default: m.GatheringStatusPage })));
const VotePage = lazy(() => import("../votes/VotePage").then((m) => ({ default: m.VotePage })));
const PlansPage = lazy(() => import("../plans/PlansPage").then((m) => ({ default: m.PlansPage })));
const PlanPage = lazy(() => import("../plans/PlanPage").then((m) => ({ default: m.PlanPage })));
const WeGroupsPage = lazy(() => import("../wegroup/WeGroupsPage").then((m) => ({ default: m.WeGroupsPage })));
const WeGroupPage = lazy(() => import("../wegroup/WeGroupPage").then((m) => ({ default: m.WeGroupPage })));
const DayRoutePage = lazy(() => import("../route/DayRoutePage").then((m) => ({ default: m.DayRoutePage })));

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
  return (
    <Suspense fallback={<PageFallback />}>
      <Routed />
    </Suspense>
  );
}

function PageFallback() {
  return (
    <>
      {[0, 1].map((row) => (
        <div key={row} className="app-card" aria-hidden="true">
          <div className="app-card-body">
            <AppSkeleton />
            <AppSkeleton variant="line-short" />
          </div>
        </div>
      ))}
    </>
  );
}

function Routed() {
  const { route, navigate } = useRoute();

  if (route.name === "event") return <EventPage id={route.id} />;
  if (route.name === "place") return <PlacePage id={route.id} />;
  if (route.name === "friends")
    return (
      <>
        <AppNavTiles
          items={[
            { icon: "pin", label: "Твои люди открыли места", onClick: () => navigate({ name: "discovery" }) },
            { icon: "user", label: "Люди с похожими интересами", onClick: () => navigate({ name: "people" }) },
          ]}
        />
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
        <AppNavTiles
          items={[
            { icon: "star", label: "Достижения", onClick: () => navigate({ name: "achievements" }) },
            { icon: "pin", label: "Мой город", onClick: () => navigate({ name: "my-city" }) },
            { icon: "bookmark", label: "Сохранённое", onClick: () => navigate({ name: "lists" }) },
            { icon: "ticket", label: "Панель организатора", onClick: () => navigate({ name: "organizer" }) },
          ]}
        />
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
