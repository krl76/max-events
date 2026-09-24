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
// - DiscoveryFriendCard - one friend row of экран 27: unseen places plus the «история посещений скрыта» state
// - DiscoveryScreen - экран 27 payload: the total of unseen places and the friend rows
// - FriendRouteScreen - экран 28 payload: the friend and their ordered stops
// - FriendRouteStop - one stop of a friend route: place, when they were there and what they did
// - FriendsSync - when the MAX contacts of the viewer were last synchronised (макет, экран 26)
// - MicroEventCard - micro-event card aggregate (макет, экран 25): the event, its venue and the participants by name
// - MicroParticipant - one participant of a micro-event card: the person and whether they are the author who called it
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
// - VoteScreen - vote plus the poll roster by name, who has already voted and whether the host finished it (макет, экран 33); mock-backed, the votes domain carries none of the three
// - VoteStatus - open while ballots are taken, closed once the host finished the vote
// - WeGroupCard - «Мы» group screen plus the agreed budget ceiling and the full photo count (макет, экраны 30 и 31); mock-backed, neither has a column
// - PlanTransferMode - how the party moves between two points of a plan: walk / metro / taxi (#504)
// - PlanTransfer - one ride between two points of a plan: mode, minutes and fare (#504, mock)
// - PlanTimelineStep - one line of макет экран 15: a stop, or the ride to the next one
// - PlanTimeline - the evening step by step plus the «MAX СОБРАЛ» flag (mock)
// - SharedCalendarPeer - whom the calendar is shared with and whether they may edit it (mock)
// - SharedCalendarEntry - one record the peer put into the shared calendar (mock)
// - SharedCalendar - shared calendar of макет экрана 22: peers, their records and the invite link (mock)
// - CheckInCode - entry code of one booking, keyed by booking id; no booking carries such a field yet (#492)
// - CreateSlotBooking - slot booking payload (slot + companions + add-ons)
// - MySlotBookingCard - экран 21 card of a booked window: booking + window + venue + company
// - MySlotWaitlistCard - экран 21 card of a waiting position: entry + window + venue
// - MySlotsBoard - экран 21 aggregate of the slot domain: own bookings and own waiting positions
// - PlaceBoard - экран 34 aggregate beyond PlacePage: opening hours, today's check-in, occupancy, visit months, windows, what is coming
// - PlaceOccupancyHour - one bar of «Когда людно»: the hour and how full the venue is, 0..1
// - PlaceSlot - one bookable window: place + time window + capacity + price (#492)
// - PlaceUpcomingEvent - one card of «Здесь скоро»: event, friends going, counter, own participation
// - PlaceVisitMonth - one cell of «Твоя история здесь»: month key and visits in it
// - SLOT_STATUSES - the window statuses in design order
// - SlotBoard - экран 19 aggregate: venue, unit, date strip, windows of one day, what is included, add-ons, company
// - SlotBooking - a booked window: entry code, party size, add-ons, total, cancellation deadline
// - SlotBookingScreen - экран 20 aggregate: booking, window, venue, company, free seats, travel estimate, chat
// - SlotChatMessage - one line of the booking chat (макет, экран 20); no chat domain exists
// - SlotDay - one cell of the date strip of экран 19: day key, forecast, whether anything is free
// - SlotExtra - a paid add-on of a booking
// - SlotStatus - availability of one window: free / held / booked
// - SlotWaitlistEntry - a waiting position on a taken window (макет, экран 21)
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
// - BookingOffer - экран 18 aggregate past EventDetails: the queue length ahead and the friends already holding tickets (#496)
// - EventCompanion - one person of экран 23: status, shared chat, shared plans, interest matches and their note
// - EventCompanions - экран 23 aggregate: the three tab counters, the viewer status, the people and the gathering teaser
// - EventForecast - hourly forecast of экран 17: attribution source, the hour columns and the warning line (#495)
// - EventGatheringTeaser - «Собирается компания» block of экран 23: who is agreeing and where they meet
// - EventMoodTag - one «Обстановка» tag of экран 17 with how many participants marked it
// - EventNearbySpot - one «Рядом» row of экран 17: a venue around the event with its walking distance in metres
// - EventWeatherHour - one column of the hourly weather strip of экран 17 (#495)
// - NOTIFICATION_TYPES - what can produce a notification of экран 07, in one closed list
// - NotificationType - union of NOTIFICATION_TYPES
// - NOTIFICATION_TARGETS - the screens a notification can open, in server vocabulary
// - NotificationTarget - union of NOTIFICATION_TARGETS
// - NotificationLink - where a notification or one of its actions leads: target + the id it needs
// - NotificationActionTone - form of an action pill: filled / dark fill / outline
// - NotificationAction - one pill of a decision card (макет, экран 07)
// - AppNotification - one inbox entry: type, actor, text, when, read state, target, pending decision and its deadline; the whole domain is mock-backed (#494)
// - NotificationsSummary - unread count behind the feed header bell
// - AnswerNotification - answer payload of a decision: who answered and which action they chose
// - WheretoPick - one suggestion of экран 12: the event plus the distance its card prints (#504)
// - WheretoPicks - GET /whereto answer: up to five picks; a superset of WheretoResponse
// - LeisureChainStop - one stop of the chain of экран 14: the contract stop plus its distance and price
// - LeisureChain - free-window chain with enriched stops; a superset of LeisureOption
// - ProfilePost - one tile of the post grid of экран 36: the post, its event and the cover the tile is drawn with
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
import { withNotifications } from "./endpoints/notifications";
import { withOrganizer } from "./endpoints/organizer";
import { withPlans } from "./endpoints/plans";
import { withProfile } from "./endpoints/profile";
import { withReviews } from "./endpoints/reviews";
import { withSlots } from "./endpoints/slots";
import { withSocial } from "./endpoints/social";
import { ApiTransport } from "./endpoints/transport";

export { REPORT_REASONS } from "./endpoints/moderation";
export type { OrganizerAttendance, OrganizerEvent, OrganizerEventOptions, OrganizerParticipant, OrganizerPlace, OrganizerRecurrence, OrganizerSlot, OrganizerSummary, OrganizerTrafficShare, OrganizerTrafficSource, OrganizerWaitlistEntry, StatsPeriodQuery, UpdateOrganizerEvent, UpdateOrganizerEventOptions, UpdateOrganizerPlace } from "./endpoints/organizer";
export type { CreateGathering, CreateMicroEvent, DiscoveryFriendCard, DiscoveryScreen, FriendRouteScreen, FriendRouteStop, FriendSuggestion, FriendsSync, MicroEventCard, MicroParticipant } from "./endpoints/social";
export type { CalendarEntry, PlanTimeline, PlanTimelineStep, PlanTransfer, PlanTransferMode, SharedCalendar, SharedCalendarEntry, SharedCalendarPeer } from "./endpoints/plans";
export { ApiError } from "./endpoints/transport";
export { EVENT_SORTS, parseEventFilters, serializeEventFilters } from "./endpoints/catalog";
export type { BookingOffer, CatalogCard, EventCompanion, EventCompanions, EventDetails, EventFilters, EventForecast, EventGatheringTeaser, EventMoodTag, EventNearbySpot, EventSort, EventWeatherHour, MapWeather, ParticipationStats, PlaceParticipation, TravelMode, TravelOption } from "./endpoints/catalog";
export type { CreateReview, EventRating, ReviewFactTag } from "./endpoints/reviews";
export { POST_AUDIENCES, STORY_AUDIENCES } from "./endpoints/feed";
export type { CreateFeedPost, FeedCard, FeedCardCounts, FeedComment, FeedFriendCard, FeedPlaceCard, FeedPost, PostAudience, PostDraft, PostDraftSaved, StoryAudience, StoryComposition, StoryPlaceSticker, StoryPoll } from "./endpoints/feed";
export type { CreateCheckIn } from "./endpoints/bookings";
export type { AddListItem, ListItemCard, ListScreen, ListSummary } from "./endpoints/lists";
export type { MyCityPayload } from "./endpoints/profile";
export { SWIPE_CATEGORIES } from "./endpoints/discover";
export type { LeisureChain, LeisureChainStop, LeisureQuery, SwipeCandidate, SwipeCategory, SwipeDecision, TodayCard, TodayDigest, WheretoPick, WheretoPicks } from "./endpoints/discover";
export type { AppSettings, ProfileCounters, UpdateAppSettings, VisitedPlace } from "./endpoints/profile";
export { ORGANIZER_TRAFFIC_SOURCES, organizerEntryCode, statsPeriodQuery } from "./endpoints/organizer";
export type { CreateReport, ModerationTarget, Report, ReportReason } from "./endpoints/moderation";
export type { VoteScreen, VoteStatus, WeGroupCard } from "./endpoints/groups";
export { SLOT_STATUSES } from "./endpoints/slots";
export type { CheckInCode, CreateSlotBooking, MySlotBookingCard, MySlotWaitlistCard, MySlotsBoard, PlaceBoard, PlaceOccupancyHour, PlaceSlot, PlaceUpcomingEvent, PlaceVisitMonth, SlotBoard, SlotBooking, SlotBookingScreen, SlotChatMessage, SlotDay, SlotExtra, SlotStatus, SlotWaitlistEntry } from "./endpoints/slots";
export { NOTIFICATION_TARGETS, NOTIFICATION_TYPES } from "./endpoints/notifications";
export type { AnswerNotification, AppNotification, NotificationAction, NotificationActionTone, NotificationLink, NotificationTarget, NotificationType, NotificationsSummary } from "./endpoints/notifications";
// Отдельной строкой, а не в список профиля выше: так правка не встречается с чужой в одной строке
export type { ProfilePost } from "./endpoints/profile";
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
const WithSlots = withSlots(WithModeration);
const WithNotifications = withNotifications(WithSlots);

export class ApiClient extends WithNotifications {}

export const apiClient = new ApiClient();

/** Fire-and-forget page-view tracking (#196): a tracking failure must never break a page, so the rejection is swallowed here. */
export function trackPageView(payload: RecordPageViewWrite): void {
  void apiClient.recordPageView(payload).catch(() => {});
}
