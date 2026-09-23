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
// - CalendarEntry - calendar item: active booking enriched with its event and place
// - CreateCheckIn - check-in payload (user + exactly one of event/place)
// - CreateFeedPost - impression publication payload (author, event, text, optional photo); the userId field is a mock-only convenience ignored by the real backend (identity comes from the init-data token)
// - CreateGathering - gathering launch payload (event + friend ids + proposed meeting time)
// - CreateMicroEvent - micro-event creation payload (author, what/when/where, limit)
// - CreateReport - report submission payload (user + exactly one of event/place/feed post + reason); the userId field is a mock-only convenience ignored by the real backend (identity comes from the init-data token)
// - CreateReview - review submission payload (user + event + scores)
// - EventDetails - event page aggregate: event, place, organizer (nullable), free seats, own active booking
// - EventFilters - optional catalog list filters (category/city/date/minRating)
// - EventRating - event page rating aggregate: RatingSummary + per-category averages
// - FeedComment - post comment attributed to its author
// - FeedPost - impression post aggregate: author, event, text, like counter/state, comments
// - LeisureQuery - free-window leisure payload (hours 1..8, mood, coordinates)
// - ListItemCard - list screen aggregate: list item enriched with its event and the participant who added it (null outside shared collections)
// - ListScreen - one-list aggregate: list + participants + item cards (shared collections surface)
// - ListSummary - lists screen aggregate: list + item count + id of the item saving the checked event (null when not saved) + participants (shared collections, mock)
// - MyCityPayload - my-city screen aggregate: summary counters + memory points
// - OrganizerEvent - contract event plus the draft flag read from the raw `published` field (returned by toEventDto; a missing flag reads as published)
// - OrganizerPlace - contract place plus the draft flag read from the raw `published` field (returned by toPlaceDto; a missing flag reads as published)
// - ParticipationStats - event page social aggregate: per-status counters, friends count, own status
// - REPORT_REASONS - report reason presets
// - Report - report entity (contract shape)
// - ReportReason - union of the report reason presets
// - StatsPeriodQuery - optional from/to window for the organizer reports
// - UpdateOrganizerEvent - minimal event edit payload (backend PATCH /events/:id whitelist)
// - UpdateOrganizerPlace - place edit payload (backend PATCH /places/:id validates CreatePlaceSchema.partial())
// - apiClient - default singleton instance
// - parseEventFilters - query string -> filters, invalid values dropped
// - serializeEventFilters - filters -> query string ("" when empty)
// - statsPeriodQuery - period into a ?from&to query string
// - trackPageView - fire-and-forget page helper over recordPageView (errors swallowed, #196)
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

export { ApiError } from "./endpoints/transport";
export { parseEventFilters, serializeEventFilters } from "./endpoints/catalog";
export type { EventDetails, EventFilters, ParticipationStats } from "./endpoints/catalog";
export type { CreateReview, EventRating } from "./endpoints/reviews";
export type { CreateFeedPost, FeedComment, FeedPost } from "./endpoints/feed";
export type { CreateGathering, CreateMicroEvent } from "./endpoints/social";
export type { CreateCheckIn } from "./endpoints/bookings";
export type { CalendarEntry } from "./endpoints/plans";
export type { AddListItem, ListItemCard, ListScreen, ListSummary } from "./endpoints/lists";
export type { MyCityPayload } from "./endpoints/profile";
export type { LeisureQuery } from "./endpoints/discover";
export { statsPeriodQuery } from "./endpoints/organizer";
export type { OrganizerEvent, OrganizerPlace, StatsPeriodQuery, UpdateOrganizerEvent, UpdateOrganizerPlace } from "./endpoints/organizer";
export { REPORT_REASONS } from "./endpoints/moderation";
export type { CreateReport, Report, ReportReason } from "./endpoints/moderation";

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
