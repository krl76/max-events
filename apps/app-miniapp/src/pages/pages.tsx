// START_MODULE_CONTRACT
// PURPOSE: Page composition for the shell routing (home feed, search with the map and the swipe deck, event, place, friends with the discovery/people entries, «Моё» (plans/calendar/saved), profile, whereto wizard, nearby screen, reverse discovery, people matching, plans, day route builder).
// SCOPE: Thin route-to-page mapping; page internals live in their own modules.
// DEPENDS: ../routing/router.js, ../catalog/MapPage.js, ../event/EventPage.js, ../place/PlacePage.js, ../friends/FriendsPage.js, ../profile/ProfilePage.js, ../whereto/WheretoPage.js, ../nearby/NearbyPage.js, ../discovery/DiscoveryPage.js, ../people/PeoplePage.js, ../assist/AssistSection.js, ../taste/AfterMeSection.js, ../plans/PlansPage.js, ../plans/PlanPage.js, ../plans/PlanCreatePage.js, ../route/DayRoutePage.js, ../micro/MicroEvents.js, ../feed/FeedPage.js, ../feed/FeedScreen.js, ../organizer/OrganizerPage.js, ../moderation/ModerationPage.js, ../promo/PromoSections.js, ../wegroup/WeGroupsPage.js, ../wegroup/WeGroupPage.js, ../votes/VotePage.js, ../search/SearchPage.js, ../swipe/SwipePage.js, ../ui/primitives.js (AppSkeleton), ../catalog/CatalogPage.js, ../today/TodaySection.js, ../create/CreatePage.js, ../create/StoryCreatePage.js, ../create/PostCreatePage.js, ../review/AfterEventPage.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - HomePage - the feed screen (FeedScreen: stories rail, «Куда пойдём?», friend and venue posts — макет, экран 03) + micro-events section (MicroSection) + NL assist section (AssistSection) + «После меня» taste suggestions (AfterMeSection, hidden until the taste graph has something) + promotion banners/collections (PromotionSections, #205). The catalog and the today digest moved to экран 08, which is their home in the design
// - RoutedPages - current page by route; event-<id> deep links render EventPage, place(id) renders PlacePage, search renders the search screen (its «На карте» entry pushes the map), map renders the full-screen map, create renders the publication hub of the «Создать» tab and story-new its story screen, feed-new the impression publish form, micro renders экран 24 «Микро-события», micro-event(id) экран 25, micro-new the micro-event creation form, friends renders экран 26 with its own entries to экраны 27 и 29, discovery renders экран 27, people экран 29, friend-route(id) экран 28 «Маршрут друга», calendar renders the «Планы» screen on the calendar tab, profile renders экран 36 with its own entry rows, after-event renders экран 35 for the event its push deep link names, subscriptions renders the follows screen, whereto renders the wizard, nearby renders the nearby timeline/leisure screen, plans renders the «Планы» screen (plans/calendar/saved tabs) and plan(id) the plan screen, day-route renders the day route builder, lists renders экран 37 and list(id) экран 39, we-groups renders экран 30 and we-group(id) экран 31, vote-new renders экран 32 (из группы приходит её id, иначе афиша целиком), vote(id) экран 33, organizer renders the legacy stub (the panel lives in the organizer space behind the organizer login), moderation renders the moderator queue (hidden behind the backend's 403 for everyone else)
// - RoutedPages - current page by route; event-<id> deep links render EventPage, place(id) renders PlacePage, search renders экран 08 (its tiles push the map and the swipe deck), map renders экран 16, swipe renders экран 09, create renders the publication hub of the «Создать» tab and story-new its story screen, friends renders the friends feed with discovery/people nav tiles (AppNavTiles), calendar renders the «Планы» screen on the calendar tab, profile renders the profile screen with achievements/subscriptions/my-city nav tiles, subscriptions renders the follows screen, whereto renders the wizard, nearby renders the nearby timeline/leisure screen, discovery renders the reverse discovery screen, people renders the people matching screen, micro-new renders the micro-event creation form, feed-new renders the post composer (макет, экран 06), plans renders the «Планы» screen (plans/calendar/saved tabs) and plan(id) the plan screen, we-groups renders the we-groups list and we-group(id) one we-group, day-route renders the day route builder, list(id) renders one saved list, organizer renders the legacy stub (the panel lives in the organizer space behind the organizer login), vote(id) renders the shared vote screen, moderation renders the moderator queue (hidden behind the backend's 403 for everyone else)
// - HomePage - the feed screen (FeedScreen: stories rail, «Куда пойдём?», friend and venue posts — макет, экран 03) + micro-events section (MicroSection) + NL assist section (AssistSection) + «После меня» taste suggestions (AfterMeSection, hidden until the taste graph has something) + today digest (TodaySection) + promotion banners/collections (PromotionSections, #205) + catalog screen (CatalogPage) on the home route; all sections hidden in map view so the map gets the viewport
// - RoutedPages - current page by route; event-<id> deep links render EventPage, place(id) renders PlacePage, search renders the search screen (its «На карте» entry pushes the map), map renders the full-screen map, create renders the publication hub of the «Создать» tab and story-new its story screen, friends renders the friends feed with discovery/people nav tiles (AppNavTiles), calendar renders the «Планы» screen on the calendar tab, profile renders экран 36 with its own entry rows, after-event renders экран 35 «После события» for the event its push deep link names, subscriptions renders the follows screen, whereto renders the wizard, nearby renders the nearby timeline/leisure screen, discovery renders the reverse discovery screen, people renders the people matching screen, micro-new renders the micro-event creation form, feed-new renders the impression publish form, plans renders the «Планы» screen (plans/calendar/saved tabs) and plan(id) the plan screen, we-groups renders the we-groups list and we-group(id) one we-group, day-route renders the day route builder, list(id) renders one saved list, organizer renders the legacy stub (the panel lives in the organizer space behind the organizer login), vote(id) renders the shared vote screen, moderation renders the moderator queue (hidden behind the backend's 403 for everyone else)
// - RoutedPages - current page by route; event-<id> deep links render EventPage, place(id) renders PlacePage, search renders the search screen (its «На карте» entry pushes the map), map renders the full-screen map, create renders the publication hub of the «Создать» tab and story-new its story screen, friends renders the friends feed with discovery/people nav tiles (AppNavTiles), calendar renders the «Планы» screen on the calendar tab, profile renders the profile screen with achievements/lists/subscriptions/my-city nav tiles, subscriptions renders the follows screen, whereto renders the wizard, nearby renders the nearby timeline/leisure screen, discovery renders the reverse discovery screen, people renders the people matching screen, micro-new renders the micro-event creation form, feed-new renders the impression publish form, plans renders the «Планы» screen (plans/calendar/saved tabs) and plan(id) the plan screen, we-groups renders the we-groups list and we-group(id) one we-group, day-route renders the day route builder, lists renders the «Списки» screen (макет, экран 37) and list(id) one saved list (макет, экран 39), organizer renders the legacy stub (the panel lives in the organizer space behind the organizer login), vote(id) renders the shared vote screen, moderation renders the moderator queue (hidden behind the backend's 403 for everyone else)
// - RoutedPages - assist(ask) renders экран 10 «MAX AI ассистент»; ask is the question the screen opens with, so a chip of экрана 15 («Дешевле», «Без такси») arrives as a typed line rather than as a silent re-query
// END_MODULE_MAP

import { lazy, Suspense, type ElementType, type LazyExoticComponent } from "react";
import { useRoute } from "../routing/router";
import { AfterMeSection } from "../taste/AfterMeSection";
import { AssistSection } from "../assist/AssistSection";
import { PromotionSections } from "../promo/PromoSections";
import { FeedScreen } from "../feed/FeedScreen";
import { MicroEventCreatePage, MicroSection } from "../micro/MicroEvents";
import { AppSkeleton } from "../ui/primitives";

/** Component type without the intrinsic (string) constituent of ElementType, i.e. any React component regardless of props. */
type AnyComponent = Exclude<ElementType, string>;

/** Lazy-load a page module and expose one of its named exports as the default (single factory instead of one per page). */
function lazyNamed<T extends Record<string, unknown>>(load: () => Promise<T>, key: keyof T): LazyExoticComponent<AnyComponent> {
  return lazy(() => load().then((m) => ({ default: m[key] as AnyComponent })));
}

// ponytail: MicroEventCreatePage shares its module with an eager home section, so it stays eager too.
const EventPage = lazyNamed(() => import("../event/EventPage"), "EventPage");
const PlacePage = lazyNamed(() => import("../place/PlacePage"), "PlacePage");
const FriendsPage = lazyNamed(() => import("../friends/FriendsPage"), "FriendsPage");
const DiscoveryPage = lazyNamed(() => import("../discovery/DiscoveryPage"), "DiscoveryPage");
const PeoplePage = lazyNamed(() => import("../people/PeoplePage"), "PeoplePage");
const ProfilePage = lazyNamed(() => import("../profile/ProfilePage"), "ProfilePage");
const SettingsPage = lazyNamed(() => import("../profile/SettingsPage"), "SettingsPage");
const OrganizerPage = lazyNamed(() => import("../organizer/OrganizerPage"), "OrganizerPage");
const ModerationPage = lazyNamed(() => import("../moderation/ModerationPage"), "ModerationPage");
const ModerationEntry = lazyNamed(() => import("../moderation/ModerationPage"), "ModerationEntry");
const ListsScreen = lazyNamed(() => import("../lists/ListsPage"), "ListsPage");
const ListPage = lazyNamed(() => import("../lists/ListsPage"), "ListPage");
const AchievementsPage = lazyNamed(() => import("../profile/AchievementsPage"), "AchievementsPage");
const AfterEventPage = lazyNamed(() => import("../review/AfterEventPage"), "AfterEventPage");
const WheretoPage = lazyNamed(() => import("../whereto/WheretoPage"), "WheretoPage");
const NearbyPage = lazyNamed(() => import("../nearby/NearbyPage"), "NearbyPage");
const GatheringFlowPage = lazyNamed(() => import("../gathering/GatheringFlowPage"), "GatheringFlowPage");
const GatheringStatusPage = lazyNamed(() => import("../gathering/GatheringStatusPage"), "GatheringStatusPage");
const VotePage = lazyNamed(() => import("../votes/VotePage"), "VotePage");
const PlansPage = lazyNamed(() => import("../plans/PlansPage"), "PlansPage");
const PlanPage = lazyNamed(() => import("../plans/PlanPage"), "PlanPage");
const PlanCreatePage = lazyNamed(() => import("../plans/PlanCreatePage"), "PlanCreatePage");
const SearchPage = lazyNamed(() => import("../search/SearchPage"), "SearchPage");
const SwipePage = lazyNamed(() => import("../swipe/SwipePage"), "SwipePage");
const MapPage = lazyNamed(() => import("../catalog/MapPage"), "MapPage");
const CreatePage = lazyNamed(() => import("../create/CreatePage"), "CreatePage");
const StoryCreatePage = lazyNamed(() => import("../create/StoryCreatePage"), "StoryCreatePage");
const PostCreatePage = lazyNamed(() => import("../create/PostCreatePage"), "PostCreatePage");
const SubscriptionsPage = lazyNamed(() => import("../subscriptions/MySubscriptions"), "SubscriptionsPage");
const WeGroupsPage = lazyNamed(() => import("../wegroup/WeGroupsPage"), "WeGroupsPage");
const WeGroupPage = lazyNamed(() => import("../wegroup/WeGroupPage"), "WeGroupPage");
const DayRoutePage = lazyNamed(() => import("../route/DayRoutePage"), "DayRoutePage");
const VoteCreatePage = lazyNamed(() => import("../votes/VoteCreatePage"), "VoteCreatePage");
const MicroEventsPage = lazyNamed(() => import("../micro/MicroEventsPage"), "MicroEventsPage");
const MicroEventPage = lazyNamed(() => import("../micro/MicroEventPage"), "MicroEventPage");
const FriendRoutePage = lazyNamed(() => import("../route/FriendRoutePage"), "FriendRoutePage");
const AssistPage = lazyNamed(() => import("../assist/AssistPage"), "AssistPage");

export function HomePage() {
  const { navigate } = useRoute();
  return (
    <>
      {/* Макет, экран 03: сторис, «Куда пойдём?» и посты — это весь верх главного экрана. */}
      <FeedScreen />
      {/* Каталог и блок «Сегодня» уехали на экран 08 — это их дом по макету. Секции ниже своего экрана
          в макете пока не имеют (ассистент — это экран 10, промо-подборки и микро-события — ничей),
          поэтому остаются здесь, а не исчезают вместе с переездом. */}
      <MicroSection onCreate={() => navigate({ name: "micro-new" })} onOpenAll={() => navigate({ name: "micro" })} />
      <AssistSection />
      <AfterMeSection />
      <PromotionSections />
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
  const { route } = useRoute();

  if (route.name === "event") return <EventPage id={route.id} />;
  if (route.name === "place") return <PlacePage id={route.id} />;
  // Экран 26 несёт входы на 27 и 29 сам — отдельные плитки над ним больше не нужны.
  if (route.name === "friends") return <FriendsPage />;
  if (route.name === "discovery") return <DiscoveryPage />;
  if (route.name === "people") return <PeoplePage />;
  if (route.name === "calendar") return <PlansPage tab="calendar" />;
  if (route.name === "search") return <SearchPage />;
  if (route.name === "swipe") return <SwipePage />;
  if (route.name === "map") return <MapPage />;
  if (route.name === "create") return <CreatePage />;
  if (route.name === "story-new") return <StoryCreatePage />;
  if (route.name === "profile")
    return (
      <>
        {/* Экран 36 несёт свои входы строками, отдельные плитки над ним больше не нужны */}
        <ProfilePage />
        {/* Its own boundary: the tile is lazy and renders nothing for most viewers, so it must not
            hold the profile behind the page skeleton while its chunk loads. */}
        <Suspense fallback={null}>
          <ModerationEntry />
        </Suspense>
      </>
    );
  if (route.name === "subscriptions") return <SubscriptionsPage />;
  if (route.name === "settings") return <SettingsPage />;
  if (route.name === "organizer") return <OrganizerPage />;
  if (route.name === "moderation") return <ModerationPage />;
  if (route.name === "lists") return <ListsScreen topbar />;
  if (route.name === "list") return <ListPage id={route.id} />;
  if (route.name === "achievements") return <AchievementsPage />;
  if (route.name === "after-event") return <AfterEventPage eventId={route.eventId} />;
  if (route.name === "whereto") return <WheretoPage />;
  if (route.name === "nearby") return <NearbyPage />;
  if (route.name === "micro-new") return <MicroEventCreatePage />;
  if (route.name === "feed-new") return <PostCreatePage eventId={route.eventId} />;
  if (route.name === "gathering-new") return <GatheringFlowPage eventId={route.eventId} />;
  if (route.name === "gathering") return <GatheringStatusPage id={route.id} />;
  if (route.name === "vote") return <VotePage id={route.id} />;
  if (route.name === "plans") return <PlansPage />;
  if (route.name === "plan") return <PlanPage id={route.id} />;
  if (route.name === "plan-new") return <PlanCreatePage />;
  if (route.name === "we-groups") return <WeGroupsPage />;
  if (route.name === "we-group") return <WeGroupPage id={route.id} />;
  if (route.name === "day-route") return <DayRoutePage />;
  if (route.name === "vote-new") return <VoteCreatePage groupId={route.groupId} />;
  if (route.name === "micro") return <MicroEventsPage />;
  if (route.name === "micro-event") return <MicroEventPage id={route.id} />;
  if (route.name === "friend-route") return <FriendRoutePage id={route.id} />;
  if (route.name === "assist") return <AssistPage ask={route.ask} />;
  return <HomePage />;
}
