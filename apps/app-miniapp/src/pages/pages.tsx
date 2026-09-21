// START_MODULE_CONTRACT
// PURPOSE: Page composition for the shell routing (home feed with whereto/nearby CTAs, event, place, friends with the discovery/people entries, «Моё» (plans/calendar/saved), profile, whereto wizard, nearby screen, reverse discovery, people matching, plans, day route builder).
// SCOPE: Thin route-to-page mapping; page internals live in their own modules.
// DEPENDS: ../routing/router.js, ../catalog/CatalogPage.js, ../catalog/MapPage.js, ../event/EventPage.js, ../place/PlacePage.js, ../friends/FriendsPage.js, ../profile/ProfilePage.js, ../whereto/WheretoPage.js, ../nearby/NearbyPage.js, ../discovery/DiscoveryPage.js, ../people/PeoplePage.js, ../today/TodaySection.js, ../assist/AssistSection.js, ../plans/PlansPage.js, ../plans/PlanPage.js, ../route/DayRoutePage.js, ../micro/MicroEvents.js, ../feed/FeedPage.js, ../organizer/OrganizerPage.js, ../promo/PromoSections.js, ../wegroup/WeGroupsPage.js, ../wegroup/WeGroupPage.js, ../votes/VotePage.js, ../search/SearchPage.js, ../ui/primitives.js (AppNavTiles)
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - HomePage - stories rail (StoriesRow) + «Куда пойдём?»/«Рядом со мной» CTA pair (primary/secondary) + NL assist section (AssistSection) + today digest (TodaySection) + impressions feed (FeedSection) + micro-events section (MicroSection) + promotion banners/collections (PromotionSections, #205) + catalog screen (CatalogPage) on the home route; all sections hidden in map view so the map gets the viewport
// - RoutedPages - current page by route; event-<id> deep links render EventPage, place(id) renders PlacePage, search renders the search screen, map renders the full-screen map, friends renders the friends feed with discovery/people nav tiles (AppNavTiles), calendar renders the «Моё» screen on the calendar tab, profile renders the profile screen with achievements/my-city (full map) nav tiles, whereto renders the wizard, nearby renders the nearby timeline/leisure screen, discovery renders the reverse discovery screen, people renders the people matching screen, micro-new renders the micro-event creation form, feed-new renders the impression publish form, plans renders the «Моё» screen (plans/calendar/saved tabs) and plan(id) the plan screen, we-groups renders the we-groups list and we-group(id) one we-group, day-route renders the day route builder, list(id) renders one saved list, organizer renders the legacy stub (the panel lives in the organizer space behind the organizer login), vote(id) renders the shared vote screen
// END_MODULE_MAP

import { lazy, Suspense, useState, type ElementType, type LazyExoticComponent } from "react";
import { useRoute } from "../routing/router";
import { CatalogPage, type CatalogViewName } from "../catalog/CatalogPage";
import { TodaySection } from "../today/TodaySection";
import { AssistSection } from "../assist/AssistSection";
import { PromotionSections } from "../promo/PromoSections";
import { FeedCreatePage, FeedSection, StoriesRow } from "../feed/FeedPage";
import { MicroEventCreatePage, MicroSection } from "../micro/MicroEvents";
import { AppNavTiles, AppSkeleton } from "../ui/primitives";

/** Component type without the intrinsic (string) constituent of ElementType, i.e. any React component regardless of props. */
type AnyComponent = Exclude<ElementType, string>;

/** Lazy-load a page module and expose one of its named exports as the default (single factory instead of one per page). */
function lazyNamed<T extends Record<string, unknown>>(load: () => Promise<T>, key: keyof T): LazyExoticComponent<AnyComponent> {
  return lazy(() => load().then((m) => ({ default: m[key] as AnyComponent })));
}

// ponytail: MicroEventCreatePage/FeedCreatePage share their module with eager home sections, so they stay eager too.
const EventPage = lazyNamed(() => import("../event/EventPage"), "EventPage");
const PlacePage = lazyNamed(() => import("../place/PlacePage"), "PlacePage");
const FriendsPage = lazyNamed(() => import("../friends/FriendsPage"), "FriendsPage");
const DiscoveryPage = lazyNamed(() => import("../discovery/DiscoveryPage"), "DiscoveryPage");
const PeoplePage = lazyNamed(() => import("../people/PeoplePage"), "PeoplePage");
const ProfilePage = lazyNamed(() => import("../profile/ProfilePage"), "ProfilePage");
const OrganizerPage = lazyNamed(() => import("../organizer/OrganizerPage"), "OrganizerPage");
const ListPage = lazyNamed(() => import("../lists/ListsPage"), "ListPage");
const AchievementsPage = lazyNamed(() => import("../profile/AchievementsPage"), "AchievementsPage");
const WheretoPage = lazyNamed(() => import("../whereto/WheretoPage"), "WheretoPage");
const NearbyPage = lazyNamed(() => import("../nearby/NearbyPage"), "NearbyPage");
const GatheringFlowPage = lazyNamed(() => import("../gathering/GatheringFlowPage"), "GatheringFlowPage");
const GatheringStatusPage = lazyNamed(() => import("../gathering/GatheringStatusPage"), "GatheringStatusPage");
const VotePage = lazyNamed(() => import("../votes/VotePage"), "VotePage");
const PlansPage = lazyNamed(() => import("../plans/PlansPage"), "PlansPage");
const PlanPage = lazyNamed(() => import("../plans/PlanPage"), "PlanPage");
const SearchPage = lazyNamed(() => import("../search/SearchPage"), "SearchPage");
const MapPage = lazyNamed(() => import("../catalog/MapPage"), "MapPage");
const WeGroupsPage = lazyNamed(() => import("../wegroup/WeGroupsPage"), "WeGroupsPage");
const WeGroupPage = lazyNamed(() => import("../wegroup/WeGroupPage"), "WeGroupPage");
const DayRoutePage = lazyNamed(() => import("../route/DayRoutePage"), "DayRoutePage");

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
  if (route.name === "calendar") return <PlansPage tab="calendar" />;
  if (route.name === "search") return <SearchPage />;
  if (route.name === "map") return <MapPage />;
  if (route.name === "profile")
    return (
      <>
        <ProfilePage />
        <AppNavTiles
          items={[
            { icon: "star", label: "Достижения", onClick: () => navigate({ name: "achievements" }) },
            { icon: "pin", label: "Мой город", onClick: () => navigate({ name: "map" }) },
          ]}
        />
      </>
    );
  if (route.name === "organizer") return <OrganizerPage />;
  if (route.name === "list") return <ListPage id={route.id} />;
  if (route.name === "achievements") return <AchievementsPage />;
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
