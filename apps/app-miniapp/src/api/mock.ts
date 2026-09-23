// START_MODULE_CONTRACT
// PURPOSE: Thin barrel of the mock API layer: re-exports the per-domain fixture stores, their pure helpers and the fetch interceptor under the import path the screens and tests already use.
// SCOPE: Re-export only. Fixtures, in-memory state and route tables live in ./mock/<domain>.ts and ./mock/<domain>.routes.ts — add a fixture or an endpoint there, not here; the interceptor order lives in ./mock/install.ts.
// DEPENDS: ./mock/*.js
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - LIST_PRESET_TITLES - ru titles of the six preset lists (mock seeds them as List.title)
// - MOCK_ASSIST_RATE_LIMIT - assist rate limit (backend AssistRateLimiter parity: 20 hits / 10 min)
// - MOCK_EARLY_ACCESS_EVENT_ID - fixture event whose booking opens in the future (early access, #202)
// - MOCK_FOREIGN_VOTE_ID - seeded vote the demo user can neither view nor vote on (403 parity)
// - MOCK_GATHERING_ID - seeded deep-link demo gathering (hosted by a friend; the demo user is an invitee so the response flow is reachable in mock mode)
// - MOCK_MODERATOR_USER_ID - the demo user, standing in for MODERATOR_MAX_USER_IDS
// - MOCK_NOW - the fixed demo "now" (noon of MOCK_TODAY) the nearby timeline buckets and leisure window are computed from
// - MOCK_ORGANIZER_CREDENTIALS - demo login/password accepted by the mock /api/auth/organizer/login
// - MOCK_ORGANIZER_PAID_EVENT_ID - seeded published paid organizer event with two frozen sales, one cancellation and four views (re-seeded idempotently by resetMockOrganizer)
// - MOCK_PROMO_CODE - seeded unlimited promo code for the early-access event
// - MOCK_SANDBOX_FAIL_AMOUNT - sandbox fail amount: a charge of exactly this sum is declined (#213)
// - MOCK_SINGLE_USE_PROMO_CODE - seeded single-use promo code (the exhausted path)
// - MOCK_TODAY - the fixed demo "today" (Moscow day key) the place page fixtures are curated for
// - MOCK_VOTE_ID - seeded deep-link demo vote (the demo user is a participant; seeded winner)
// - OFFER_TTL_MS - 15-minute confirmation window of a waitlist offer
// - SHARED_COLLECTION_TITLE - ru title of the seeded shared collection
// - achievementsFor - the four README achievements with progress derived from visit stats
// - afterMePicks - mock GET /taste/after-me: more of the strongest visited category, backend wording parity
// - banMockOrganizer - mock POST /moderation/ban
// - bannedMockOrganizers - who the mock has banned (test isolation)
// - buildMockDayRoute - resolve 2..8 event/place stops to points and haversine walking legs (mock POST /routes, backend parity)
// - calendarEntries - active bookings of a user enriched with event and place
// - cancelMockPlan - mock DELETE /plans/:id: one meeting or the whole series
// - castMockBallot - mock POST /votes/:id/ballots: one ballot per user, a repeated ballot replaces the previous one; winner = max votes then option position, null without ballots (backend parity)
// - createMockAutoPlan - autoplan after «Пойду»: saved draft plan + walk estimate + food picks + dinner->road->meetup->event timeline (mock POST /plans/auto, backend parity)
// - createMockCheckIn - in-memory check-in for an event or a place, idempotent (mock POST)
// - createMockGathering - in-memory gathering with deterministic invitee responses and a sent chat card (chatLink set, successful MaxBot parity) (mock POST)
// - createMockList - mock POST /lists: a list of one's own (409 past the ceiling)
// - createMockMicroEvent - create a micro event, author counts as the first participant (mock POST)
// - createMockPlan - mock POST /plans: the manual plan plus the occurrences of its series
// - createMockReport - in-memory deduplicated report (mock POST /reports, duplicate -> 409, unknown target -> "no_target")
// - createMockStory - publish the own mock story from a data-URL photo (localStorage)
// - createMockSubscription - mock POST /subscriptions: idempotent per target, "unknown" for an unknown place or organizer (backend 404 parity)
// - createMockVote - in-memory vote with a sent chat card (chatLink set, successful MaxBot parity); participants must be friends of the demo host, events must exist (mock POST /votes, backend VotesService parity)
// - discoverySummary - per-friend unseen places minus the demo user's check-ins, privacy-gated (mock GET /discovery, backend DiscoveryService.summary parity)
// - eventRating - rating summary and per-category averages for an event from the mock reviews
// - feedPosts - impression posts newest first, optionally only one event (the event wall)
// - filterMockEvents - apply catalog filters to fixtures (date matches the local day of startsAt)
// - friendActivityByFriend - friend participations grouped by friend (feed payload)
// - friendAvailability - per-friend free/busy/unknown for the gathering flow (mock)
// - friendPlaceLayer - mock GET /discovery/friend-places: places friends checked in at, grouped, privacy-gated
// - friendRoute - chronological unseen places of one friend; own/not-friend/hidden map to 403/404/403 (mock GET /discovery/friends/:userId/route, backend parity)
// - friendSuggestions - mock GET /friends/suggestions: the onboarding contacts with their hint line and current follow state
// - getMockVote - mock GET /votes/:id (404 unknown, 403 neither host nor participant); myBallotEventId comes from the demo user's stored ballot (backend #324 parity)
// - installMockApi - intercept global fetch for /api/events, /api/places, /api/places/:id, /api/places/:id/page, /api/events/:id/rating, /api/events/:id/participation, /api/bookings and /api/bookings/:id/payment, /api/calendar, /api/waitlist[/me|/:id/confirm|/:id/decline], /api/check-ins, /api/users/:id/visit-stats, /api/users/:id/achievements, /api/users/:id/my-city, /api/profile, /api/friends[/activity|/availability|/suggestions|/follows], /api/gatherings[/:id|/:id/response], /api/votes[/:id[/ballots]], /api/plans[/auto|/:id/budget|/:id/expenses] and /api/we-groups[/:id[/events|/places|/archive]], /api/routes[/optimize], /api/lists[/:id[/items[/:itemId]]], /api/feed[/:id/like|comments], /api/reviews, /api/reports, /api/micro-events, /api/today, /api/whereto, /api/nearby[/free], /api/discovery[/friend-places|/friends/:userId/route], /api/people, /api/promotions/placements, /api/promotions/for-me, /api/organizer/events|places[/:id/publish] and PATCH /api/events|places/:id and /api/assist[/day], return a restore function
// - isMockModerator - whether this viewer may see the moderation queue
// - joinMockMicroEvent - join with the counter, idempotent (mock POST /join)
// - leaveMockMicroEvent - leave with the counter, idempotent (mock DELETE /join)
// - leisureOptions - deterministic per-mood leisure chains from fixtures inside the free window (mock GET /nearby/free)
// - listItemCards - items of one list enriched with their events and the participant who added them, newest first (mock)
// - listMockStories - own story (localStorage) + friend fixtures
// - listMockSubscriptions - mock GET /subscriptions for the demo user
// - listMockWeGroups - mock GET /we-groups: screens of the demo user's groups, newest first
// - listSummaries - preset lists of a user with item counters, the saved-item id for the checked event and shared-collection participants
// - microEvents - open micro-events soonest first
// - mockAssistDay - upcoming Saturday stops (startsAt >= now) + planDraft, plan persisted when save=true (mock POST /assist/day, backend planSaturday parity)
// - mockAssistSaturdayKey - next Saturday (today counts) Moscow day key from MOCK_NOW (backend nextSaturdayKey parity)
// - mockAssistSuggest - explained picks with history/partner explanations (mock POST /assist, backend AssistService.suggest parity)
// - mockBudgetFromExpenses - expenses -> per-person nets + debts (backend budgetFromExpenses parity, incl. the id-rotated remainder split)
// - mockDemoUser - demo user returned by mock auth outside MAX (VITE_USE_MOCK=1); the id matches the booking/profile fixtures
// - mockEvents - Moscow event fixtures (all four categories, paid and free, incl. two past events for the review flow, one event "today" for the place page, two MOCK_TODAY daytime events filling the nearby now/inAnHour buckets)
// - mockFriendIds - friend user ids of the demo user (social counters fixtures)
// - mockFriendStories - seeded friend story fixtures (gradient placeholder images)
// - mockFriends - friend fixtures for the "Your people are going" feed
// - mockOnboardingContacts - the twelve MAX contacts the onboarding friends step offers: the seven friend fixtures plus five contacts who are not friends yet
// - mockOrganization - demo organization returned by the mock organizer login
// - mockOrganizers - demo organizer fixture for event details
// - mockParseAssistQuery - deterministic NL criteria heuristics (backend parse-nl parity)
// - mockPlaces - Moscow venue fixtures (incl. two food spots — Депо and the Gorky Park food court feeding the autoplan food picks)
// - mockPlanBudget - mock GET /plans/:id/budget (404 unknown plan)
// - mockPlans - plan card fixtures for the plans list and plan screens; the demo plan carries a chat link, the second one none (backend P1-7-b does not exist yet)
// - mockPromotionPlacements - placements fixture: 2 banners, 1 pin, boosted ids, promoted=true (mock GET /promotions/placements, #205); the /api/events listing flags the placement events promoted (backend promotedEventIds parity)
// - mockTargetedPromotions - one target collection with the explanation derived from the demo check-in history (mock GET /promotions/for-me, #205)
// - myCityFor - my-city summary and memory points derived from the check-ins of a user
// - nearbyTimeline - four-bucket nearby timeline from fixtures, haversine distance from the requested coords (mock GET /nearby)
// - openMockReports - mock GET /reports?status=open
// - optimizeMockDayRoute - keep-first permutation minimizing the total distance, with savings (mock POST /routes/optimize)
// - participationStats - per-event status counters, friends count and own status
// - peopleSuggest - mockFriends matched on seeded interests or a shared upcoming event with distances from the requested coords (mock GET /people, backend PeopleService parity)
// - placePageFor - place social page aggregate: today events, friend visits, place rating, popularity, personal visits (mock)
// - planCard - single plan card by plan id (or null)
// - planCards - plan fixtures sorted by the soonest meeting first
// - removeMockList - mock DELETE /lists/:id with its items (403 for a preset)
// - removeMockSubscription - mock DELETE /subscriptions/:id, "unknown" when it is already gone
// - renameMockList - mock PATCH /lists/:id (403 for a preset)
// - resetMockAssist - clear the assist rate-limit window (test isolation)
// - resetMockBookings - clear in-memory bookings and payments (test isolation)
// - resetMockCampaigns - clear in-memory promo campaigns (test isolation)
// - resetMockCheckIns - clear in-memory check-ins (test isolation)
// - resetMockFeed - restore seeded impression posts (test isolation)
// - resetMockFollows - restore the three seeded follows (test isolation)
// - resetMockGatherings - restore the seeded demo gathering and clear created ones (test isolation)
// - resetMockLists - clear in-memory lists (test isolation)
// - resetMockMicroEvents - restore seeded micro-events (test isolation)
// - resetMockOrganizer - restore the seeded organizer drafts (test isolation)
// - resetMockParticipations - restore seeded participations (test isolation)
// - resetMockPlans - restore seeded plan cards, dropping autoplan drafts (test isolation)
// - resetMockProfiles - restore the seeded friend profiles (test isolation)
// - resetMockPromo - restore seeded promo codes and redemption counters (test isolation)
// - resetMockPromoCodes - clear in-memory promocodes (test isolation)
// - resetMockPromotions - clear in-memory promotion campaigns (test isolation)
// - resetMockReports - clear in-memory reports and bans, republish what moderation hid (test isolation)
// - resetMockReviews - restore seeded reviews (test isolation)
// - resetMockSubscriptions - clear in-memory follows (test isolation)
// - resetMockVotes - restore the two seeded votes (test isolation)
// - resetMockWaitlist - clear the in-memory waitlist (test isolation)
// - resetMockWeGroups - restore seeded groups and plan expenses (test isolation)
// - resolveMockReport - mock POST /reports/:id/resolve
// - respondMockGathering - demo-user invitee answer write (mock PATCH /gatherings/:id/response; 404 unknown, 403 host-or-outsider, backend respond parity)
// - setMockModerator - put the demo user in or out of MODERATOR_MAX_USER_IDS (demo / tests)
// - tasteProfile - taste graph of a user, derived from their mock check-ins (empty until they visit something)
// - todayPicks - "What to do today?" digest from fixtures (summary counters + three curated cards)
// - unpublishMockTarget - mock POST /moderation/unpublish
// - wheretoSuggestions - "Куда пойдём?" suggestions from upcoming fixtures (backend selectWheretoItems parity, max 5)
// END_MODULE_MAP

export { MOCK_PROMO_CODE, MOCK_SANDBOX_FAIL_AMOUNT, MOCK_SINGLE_USE_PROMO_CODE, OFFER_TTL_MS, createMockCheckIn, resetMockBookings, resetMockCheckIns, resetMockPromo, resetMockWaitlist } from "./mock/bookings";
export { filterMockEvents, participationStats, placePageFor, resetMockParticipations } from "./mock/catalog";
export { MOCK_ASSIST_RATE_LIMIT, leisureOptions, mockAssistDay, mockAssistSaturdayKey, mockAssistSuggest, mockParseAssistQuery, nearbyTimeline, resetMockAssist, todayPicks, wheretoSuggestions } from "./mock/discover";
export { createMockStory, feedPosts, listMockStories, mockFriendStories, resetMockFeed } from "./mock/feed";
export { MOCK_EARLY_ACCESS_EVENT_ID, MOCK_NOW, MOCK_ORGANIZER_CREDENTIALS, MOCK_TODAY, mockDemoUser, mockEvents, mockFriendIds, mockFriends, mockOrganization, mockOrganizers, mockPlaces } from "./mock/fixtures";
export { MOCK_FOREIGN_VOTE_ID, MOCK_VOTE_ID, castMockBallot, createMockVote, getMockVote, listMockWeGroups, resetMockVotes, resetMockWeGroups } from "./mock/groups";
export { installMockApi } from "./mock/install";
export { LIST_PRESET_TITLES, SHARED_COLLECTION_TITLE, createMockList, createMockSubscription, listItemCards, listMockSubscriptions, listSummaries, removeMockList, removeMockSubscription, renameMockList, resetMockLists, resetMockSubscriptions } from "./mock/lists";
export { MOCK_MODERATOR_USER_ID, banMockOrganizer, bannedMockOrganizers, createMockReport, isMockModerator, openMockReports, resetMockReports, resolveMockReport, setMockModerator, unpublishMockTarget } from "./mock/moderation";
export { MOCK_ORGANIZER_PAID_EVENT_ID, resetMockCampaigns, resetMockOrganizer, resetMockPromoCodes, resetMockPromotions } from "./mock/organizer";
export { buildMockDayRoute, calendarEntries, cancelMockPlan, createMockAutoPlan, createMockPlan, mockBudgetFromExpenses, mockPlanBudget, mockPlans, optimizeMockDayRoute, planCard, planCards, resetMockPlans } from "./mock/plans";
export { achievementsFor, afterMePicks, myCityFor, resetMockProfiles, tasteProfile } from "./mock/profile";
export { mockPromotionPlacements, mockTargetedPromotions } from "./mock/promo";
export { eventRating, resetMockReviews } from "./mock/reviews";
export { MOCK_GATHERING_ID, createMockGathering, createMockMicroEvent, discoverySummary, friendActivityByFriend, friendAvailability, friendPlaceLayer, friendRoute, friendSuggestions, joinMockMicroEvent, leaveMockMicroEvent, microEvents, mockOnboardingContacts, peopleSuggest, resetMockFollows, resetMockGatherings, resetMockMicroEvents, respondMockGathering } from "./mock/social";
