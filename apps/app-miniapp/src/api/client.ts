// START_MODULE_CONTRACT
// PURPOSE: Thin barrel of the typed api client: composes the per-domain endpoint mixins into ApiClient, exposes the apiClient singleton and re-exports the domain types under the import path the screens already use.
// SCOPE: Mixin composition and re-export only; every endpoint, aggregate and payload type lives in ./endpoints/<domain>.ts — add a new endpoint there, not here.
// DEPENDS: ./endpoints/transport.js and the per-domain mixins next to it
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - AddListItem - save-to-list payload (owner user + saved event)
// - ApiClient - configurable fetch wrapper with typed methods
// - ApiError - unified API error with HTTP status
// - AppSettings - экран 41 preferences the Profile contract has no field for (radius, quiet hours, visibility, waitlist alerts, organizer mode, mini-app permissions)
// - CalendarEntry - calendar item: active booking enriched with its event and place
// - CatalogCard - list card of экран 08: event plus distance, rating and venue line, nullable until the list DTO carries them (#496)
// - CreateCheckIn - check-in payload (user + exactly one of event/place)
// - CreateFeedPost - impression publication payload (author, event, text, optional photo, plus the place/friends/audience/join fields of макет, экран 06 that the backend still strips, #502); the userId field is a mock-only convenience ignored by the real backend (identity comes from the init-data token)
// - CreateGathering - gathering launch payload (event + friend ids + proposed meeting time)
// - CreateMicroEvent - micro-event creation payload (author, what/when/where, limit)
// - CreateReport - report submission payload (user + exactly one of event/place/feed post + reason); the userId field is a mock-only convenience ignored by the real backend (identity comes from the init-data token)
// - CreateReview - review submission payload (user + event + scores)
// - EVENT_SORTS - the catalog orderings экран 08 may ask for (#497)
// - CreateReview - review submission payload (user + event + scores + fact tags)
// - EventDetails - event page aggregate: event, place, organizer (nullable), free seats, own active booking
// - EventFilters - optional catalog list filters (category/city/date/minRating/query/sort)
// - EventRating - event page rating aggregate: RatingSummary + per-category averages
// - EventSort - catalog ordering: soonest / nearest / best rated (#497)
// - FeedCard - discriminated union of the two home feed card kinds (макет, экран 03)
// - FeedCardCounts - social counters of one feed card (wants to go / going / waitlist / free seats), nullable until the list DTO carries them (#496)
// - FeedComment - post comment attributed to its author
// - FeedFriendCard - friend post of the home feed: author, event hero, counters, caption, comments
// - FeedPlaceCard - venue post of the home feed: place header, slot offer, friend quote, viewer status block
// - FeedPost - impression post aggregate: author, event, text, like counter/state, comments
// - FriendSuggestion - one person of the onboarding friends step: friend + the hint line under the name + whether the viewer follows them
// - LeisureQuery - free-window leisure payload (hours 1..8, mood, coordinates)
// - ListItemCard - list screen aggregate: list item enriched with its event and the participant who added it (null outside shared collections)
// - ListScreen - one-list aggregate: list + participants + item cards (shared collections surface)
// - ListSummary - lists screen aggregate: list + item count + id of the item saving the checked event (null when not saved) + participants (shared collections, mock)
// - MapWeather - city weather behind the map chip (макет, экран 16): now plus the change to come (#495)
// - MyCityPayload - my-city screen aggregate: summary counters + memory points
// - ProfileCounters - the three counters of экран 36 (events / places / companies), companies nullable until a service counts them (#496)
// - ReviewFactTag - one «Что было правдой?» tag of экран 35 (code + ru label), mock-backed until the tag dictionary lands (#500)
// - UpdateAppSettings - partial AppSettings patch
// - VisitedPlace - one cell of the impressions grid: place, title and visit count
// - NotificationsSummary - unread count behind the feed header bell; mock-only until the notifications domain exists (#494)
// - OrganizerEvent - contract event plus the draft flag read from the raw `published` field (returned by toEventDto; a missing flag reads as published)
// - OrganizerPlace - contract place plus the draft flag read from the raw `published` field (returned by toPlaceDto; a missing flag reads as published)
// - POST_AUDIENCES - «Кто увидит» chips of the post composer in design order (макет, экран 06)
// - ParticipationStats - event page social aggregate: per-status counters, friends count, own status
// - PlaceParticipation - viewer status on a venue (макет, экран 03); the place-level twin of Participation (#492)
// - PostAudience - who a published post is shown to: friends / city / the company only (#502)
// - PostDraft - autosave payload of the post composer (макет, экран 06); no draft table exists (#502)
// - PostDraftSaved - when the draft was last stored, behind the «Черновик сохранён» line
// - REPORT_REASONS - report reason presets
// - Report - report entity (contract shape)
// - ReportReason - union of the report reason presets
// - StatsPeriodQuery - optional from/to window for the organizer reports
// - STORY_AUDIENCES - audiences of the story composer in design order (макет, экран 05)
// - StoryAudience - who a published story is shown to: close friends / friends / city (#502)
// - StoryComposition - caption, place sticker, poll and audience a composed story carries (#502)
// - StoryPlaceSticker - place sticker of a story: title, venue line, free seats (макет, экран 05)
// - StoryPoll - poll drawn on a story: question, options, highlighted answer (макет, экран 05)
// - SWIPE_CATEGORIES - the four filter chips of экран 09 in design order
// - SwipeCandidate - one card of the swipe deck: venue, amenities, friends and the match score (#498)
// - SwipeCategory - the filter chips of экран 09 (Все / Еда / На природе / Спорт)
// - SwipeDecision - what a swipe meant: right into favourites, left past it
// - TodayCard - one card of the digest: a CatalogCard plus its typed labels (макет, экран 08)
// - TodayDigest - digest response of экран 08: the three counters plus the cards
// - TravelMode - how the traveller gets to the object: on foot or by metro (#504)
// - TravelOption - one way to the object: minutes, distance, transfers (#504)
// - UpdateOrganizerEvent - minimal event edit payload (backend PATCH /events/:id whitelist)
// - UpdateOrganizerPlace - place edit payload (backend PATCH /places/:id validates CreatePlaceSchema.partial())
// - apiClient - default singleton instance
// - parseEventFilters - query string -> filters, invalid values dropped
// - serializeEventFilters - filters -> query string ("" when empty)
// - statsPeriodQuery - period into a ?from&to query string
// - trackPageView - fire-and-forget page helper over recordPageView (errors swallowed, #196)
// - ModerationTarget - what a queue row is about: the reported object's title, its author and its reach (макет, экраны 46 и 47)
// - ORGANIZER_TRAFFIC_SOURCES - where a booking came from, in the order экраны 42 и 45 list it
// - OrganizerAttendance - the event day of экран 44: counters, participants, waitlist, slots
// - OrganizerEventOptions - the экран 43 switches the Event contract has no field for (waitlist, in-app registration, external link, recurrence)
// - OrganizerParticipant - one «Отметились»/«Ждём» row of экран 44
// - OrganizerRecurrence - «Повторять каждую неделю» of экран 43: rule + the date the series runs to
// - OrganizerSlot - one venue slot chip of экран 44 (#492)
// - OrganizerSummary - organizer-wide period report of экраны 42 и 45
// - OrganizerTrafficShare - one «Откуда приходят» row: source + percent
// - OrganizerTrafficSource - union of the traffic sources
// - OrganizerWaitlistEntry - one waitlist row of экран 44
// - UpdateOrganizerEventOptions - partial OrganizerEventOptions patch
// - organizerEntryCode - entry code of a booking, derived from its id (no code column exists yet)
// END_MODULE_MAP

import type { RecordPageViewWrite } from "@max-events/api-contracts";
import { withAuth } from "./endpoints/auth";
import { withBookings } from "./endpoints/bookings";
import { withCatalog } from "./endpoints/catalog";
import { withDiscover } from "./endpoints/discover";
import { withFeed } from "./endpoints/feed";
import { withGroups } from "./endpoints/groups";
import { withLists } from "./endpoints/lists";
import { withModeration } from "./endpoints/moderation";
import { withOrganizer } from "./endpoints/organizer";
import { withPlans } from "./endpoints/plans";
import { withProfile } from "./endpoints/profile";
import { withReviews } from "./endpoints/reviews";
import { withSocial } from "./endpoints/social";
import { ApiTransport } from "./endpoints/transport";

export { REPORT_REASONS } from "./endpoints/moderation";
export type { OrganizerAttendance, OrganizerEvent, OrganizerEventOptions, OrganizerParticipant, OrganizerPlace, OrganizerRecurrence, OrganizerSlot, OrganizerSummary, OrganizerTrafficShare, OrganizerTrafficSource, OrganizerWaitlistEntry, StatsPeriodQuery, UpdateOrganizerEvent, UpdateOrganizerEventOptions, UpdateOrganizerPlace } from "./endpoints/organizer";
export type { CalendarEntry } from "./endpoints/plans";
export type { CreateGathering, CreateMicroEvent, FriendSuggestion } from "./endpoints/social";
export { ApiError } from "./endpoints/transport";
export { EVENT_SORTS, parseEventFilters, serializeEventFilters } from "./endpoints/catalog";
export type { CatalogCard, EventDetails, EventFilters, EventSort, MapWeather, ParticipationStats, PlaceParticipation, TravelMode, TravelOption } from "./endpoints/catalog";
export type { CreateReview, EventRating, ReviewFactTag } from "./endpoints/reviews";
export { POST_AUDIENCES, STORY_AUDIENCES } from "./endpoints/feed";
export type { CreateFeedPost, FeedCard, FeedCardCounts, FeedComment, FeedFriendCard, FeedPlaceCard, FeedPost, NotificationsSummary, PostAudience, PostDraft, PostDraftSaved, StoryAudience, StoryComposition, StoryPlaceSticker, StoryPoll } from "./endpoints/feed";
export type { CreateCheckIn } from "./endpoints/bookings";
export type { AddListItem, ListItemCard, ListScreen, ListSummary } from "./endpoints/lists";
export type { MyCityPayload } from "./endpoints/profile";
export { SWIPE_CATEGORIES } from "./endpoints/discover";
export type { LeisureQuery, SwipeCandidate, SwipeCategory, SwipeDecision, TodayCard, TodayDigest } from "./endpoints/discover";
export type { AppSettings, ProfileCounters, UpdateAppSettings, VisitedPlace } from "./endpoints/profile";
export { ORGANIZER_TRAFFIC_SOURCES, organizerEntryCode, statsPeriodQuery } from "./endpoints/organizer";
export type { CreateReport, ModerationTarget, Report, ReportReason } from "./endpoints/moderation";
// One mixin per domain, applied in a flat chain: a new domain is one more line here plus its own file, and
// adding an endpoint to an existing domain never touches this file at all.
const WithAuth = withAuth(ApiTransport);
const WithCatalog = withCatalog(WithAuth);
const WithReviews = withReviews(WithCatalog);
const WithFeed = withFeed(WithReviews);
const WithSocial = withSocial(WithFeed);
const WithGroups = withGroups(WithSocial);
const WithBookings = withBookings(WithGroups);
const WithPlans = withPlans(WithBookings);
const WithLists = withLists(WithPlans);
const WithProfile = withProfile(WithLists);
const WithDiscover = withDiscover(WithProfile);
const WithOrganizer = withOrganizer(WithDiscover);
const WithModeration = withModeration(WithOrganizer);

export class ApiClient extends WithModeration {}

export const apiClient = new ApiClient();

/** Fire-and-forget page-view tracking (#196): a tracking failure must never break a page, so the rejection is swallowed here. */
export function trackPageView(payload: RecordPageViewWrite): void {
  void apiClient.recordPageView(payload).catch(() => {});
}
