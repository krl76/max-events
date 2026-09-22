// START_MODULE_CONTRACT
// PURPOSE: Mock API layer for the catalog, event page, profile, calendar, friends feed, shared plans, check-ins, achievements, my-city, post-event reviews, reports, UGC micro-events, the place social page, the nearby timeline/leisure surface, reverse discovery and people matching while backend endpoints (M2–M5, P2) do not exist yet.
// SCOPE: In-memory Moscow fixtures (events/places/organizers, incl. two past events with a seeded demo booking for the review flow, plus MOCK_TODAY-curated events filling the nearby buckets), in-memory bookings with a two-phase demo model of the sandbox fail rule (pending at booking, settle on POST /bookings/:id/payment; the real sandbox provider settles instantly at create), FIFO waitlist with timed confirmation offers, check-ins, seeded friend profiles (interests/privacy) and friend place visits, plan cards, autoplan drafts, day routes, preset lists, seeded reviews with rating aggregates and deduplicated reports, open micro-events with join/leave counters, achievements and my-city derived from check-ins, pure fixture filtering, nearby timeline buckets and leisure chains relative to MOCK_NOW, reverse discovery of friend places the demo user has not visited, people matching on seeded interests/participations, NL assist with deterministic criteria parsing, history/partner explanations, Saturday stops and rate-limit parity, promotion placements/targeted fixtures and promo-code booking validation (#202/#205), fetch interceptor enabled by VITE_USE_MOCK=1 in main.tsx.
// DEPENDS: ./client.js (parseEventFilters, EventFilters, CreateGathering, AddListItem, ListSummary, ListItemCard, CreateMicroEvent, CreateReview, CreateReport, Report, EventRating), @max-events/api-contracts (Event, Place, User, Booking, Profile, PlanCard, List, ListItem, CheckIn, VisitStats, Achievement, MyCitySummary, MemoryPoint, MicroEvent, Review, WaitlistEntry, NearbyCard, NearbyTimeline, NearbyBucket, LeisureMood, LeisureOption, AutoPlanProposal, DayRoute, OptimizeRoute, RoutePoint, AssistCriteria, AssistQueryWrite, AssistResponse, AssistPick, AssistDayResponse, DiscoveryFriendPlaces, DiscoveryResponse, FriendRoute, PeopleCandidate, PeopleMatchContext, PeopleResponse, CreateBookingSchema, CreateAutoPlanWriteSchema, CreateDayRouteWriteSchema, MicroEventSchema, ReviewSchema, UpdateProfileSchema, LeisureMoodSchema, AssistQueryWriteSchema, IdSchema, CreateEventSchema, CreatePlaceSchema, EventSchema, CreateEvent, CreatePlace; PromotionPlacements, TargetedPromotionsResponse)
// LINKS: M-APP-MINIAPP, M-PKG-API-CONTRACTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - mockPlaces - Moscow venue fixtures (incl. two food spots — Депо and the Gorky Park food court feeding the autoplan food picks)
// - mockEvents - Moscow event fixtures (all four categories, paid and free, incl. two past events for the review flow, one event "today" for the place page, two MOCK_TODAY daytime events filling the nearby now/inAnHour buckets)
// - MOCK_TODAY - the fixed demo "today" (Moscow day key) the place page fixtures are curated for
// - MOCK_NOW - the fixed demo "now" (noon of MOCK_TODAY) the nearby timeline buckets and leisure window are computed from
// - nearbyTimeline - four-bucket nearby timeline from fixtures, haversine distance from the requested coords (mock GET /nearby)
// - leisureOptions - deterministic per-mood leisure chains from fixtures inside the free window (mock GET /nearby/free)
// - mockOrganizers - demo organizer fixture for event details
// - resetMockMicroEvents - restore seeded micro-events (test isolation)
// - microEvents - open micro-events soonest first
// - createMockMicroEvent - create a micro event, author counts as the first participant (mock POST)
// - joinMockMicroEvent - join with the counter, idempotent (mock POST /join)
// - leaveMockMicroEvent - leave with the counter, idempotent (mock DELETE /join)
// - resetMockFeed - restore seeded impression posts (test isolation)
// - feedPosts - impression posts newest first, optionally only one event (the event wall)
// - mockDemoUser - demo user returned by mock auth outside MAX (VITE_USE_MOCK=1); the id matches the booking/profile fixtures
// - mockOrganization - demo organization returned by the mock organizer login
// - MOCK_ORGANIZER_CREDENTIALS - demo login/password accepted by the mock /api/auth/organizer/login
// - mockFriendStories - seeded friend story fixtures (gradient placeholder images)
// - listMockStories - own story (localStorage) + friend fixtures
// - createMockStory - publish the own mock story from a data-URL photo (localStorage)
// - mockFriendIds - friend user ids of the demo user (social counters fixtures)
// - mockFriends - friend fixtures for the "Your people are going" feed
// - friendActivityByFriend - friend participations grouped by friend (feed payload)
// - friendAvailability - per-friend free/busy/unknown for the gathering flow (mock)
// - createMockGathering - in-memory gathering with deterministic invitee responses and a sent chat card (chatLink set, successful MaxBot parity) (mock POST)
// - MOCK_GATHERING_ID - seeded deep-link demo gathering (hosted by a friend; the demo user is an invitee so the response flow is reachable in mock mode)
// - respondMockGathering - demo-user invitee answer write (mock PATCH /gatherings/:id/response; 404 unknown, 403 host-or-outsider, backend respond parity)
// - resetMockGatherings - restore the seeded demo gathering and clear created ones (test isolation)
// - resetMockVotes - restore the two seeded votes (test isolation)
// - MOCK_VOTE_ID - seeded deep-link demo vote (the demo user is a participant; seeded winner)
// - MOCK_FOREIGN_VOTE_ID - seeded vote the demo user can neither view nor vote on (403 parity)
// - createMockVote - in-memory vote with a sent chat card (chatLink set, successful MaxBot parity); participants must be friends of the demo host, events must exist (mock POST /votes, backend VotesService parity)
// - getMockVote - mock GET /votes/:id (404 unknown, 403 neither host nor participant); myBallotEventId comes from the demo user's stored ballot (backend #324 parity)
// - castMockBallot - mock POST /votes/:id/ballots: one ballot per user, a repeated ballot replaces the previous one; winner = max votes then option position, null without ballots (backend parity)
// - mockPlans - plan card fixtures for the plans list and plan screens; the demo plan carries a chat link, the second one none (backend P1-7-b does not exist yet)
// - resetMockPlans - restore seeded plan cards, dropping autoplan drafts (test isolation)
// - planCards - plan fixtures sorted by the soonest meeting first
// - planCard - single plan card by plan id (or null)
// - mockBudgetFromExpenses - expenses -> per-person nets + debts (backend budgetFromExpenses parity, incl. the id-rotated remainder split)
// - mockPlanBudget - mock GET /plans/:id/budget (404 unknown plan)
// - resetMockWeGroups - restore seeded groups and plan expenses (test isolation)
// - listMockWeGroups - mock GET /we-groups: screens of the demo user's groups, newest first
// - createMockAutoPlan - autoplan after «Пойду»: saved draft plan + walk estimate + food picks + dinner->road->meetup->event timeline (mock POST /plans/auto, backend parity)
// - buildMockDayRoute - resolve 2..8 event/place stops to points and haversine walking legs (mock POST /routes, backend parity)
// - optimizeMockDayRoute - keep-first permutation minimizing the total distance, with savings (mock POST /routes/optimize)
// - MOCK_ASSIST_RATE_LIMIT - assist rate limit (backend AssistRateLimiter parity: 20 hits / 10 min)
// - resetMockAssist - clear the assist rate-limit window (test isolation)
// - mockParseAssistQuery - deterministic NL criteria heuristics (backend parse-nl parity)
// - mockAssistSuggest - explained picks with history/partner explanations (mock POST /assist, backend AssistService.suggest parity)
// - mockAssistSaturdayKey - next Saturday (today counts) Moscow day key from MOCK_NOW (backend nextSaturdayKey parity)
// - mockAssistDay - upcoming Saturday stops (startsAt >= now) + planDraft, plan persisted when save=true (mock POST /assist/day, backend planSaturday parity)
// - resetMockOrganizer - restore the seeded organizer drafts (test isolation)
// - filterMockEvents - apply catalog filters to fixtures (date matches the local day of startsAt)
// - LIST_PRESET_TITLES - ru titles of the six preset lists (mock seeds them as List.title)
// - SHARED_COLLECTION_TITLE - ru title of the seeded shared collection
// - listSummaries - preset lists of a user with item counters, the saved-item id for the checked event and shared-collection participants
// - listItemCards - items of one list enriched with their events and the participant who added them, newest first (mock)
// - resetMockLists - clear in-memory lists (test isolation)
// - resetMockReviews - restore seeded reviews (test isolation)
// - eventRating - rating summary and per-category averages for an event from the mock reviews
// - resetMockReports - clear in-memory reports (test isolation)
// - createMockReport - in-memory deduplicated report (mock POST /reports, duplicate -> 409, unknown target -> "no_target")
// - resetMockBookings - clear in-memory bookings and payments (test isolation)
// - MOCK_SANDBOX_FAIL_AMOUNT - sandbox fail amount: a charge of exactly this sum is declined (#213)
// - MOCK_EARLY_ACCESS_EVENT_ID - fixture event whose booking opens in the future (early access, #202)
// - MOCK_PROMO_CODE - seeded unlimited promo code for the early-access event
// - MOCK_SINGLE_USE_PROMO_CODE - seeded single-use promo code (the exhausted path)
// - resetMockPromo - restore seeded promo codes and redemption counters (test isolation)
// - mockPromotionPlacements - placements fixture: 2 banners, 1 pin, boosted ids, promoted=true (mock GET /promotions/placements, #205); the /api/events listing flags the placement events promoted (backend promotedEventIds parity)
// - mockTargetedPromotions - one target collection with the explanation derived from the demo check-in history (mock GET /promotions/for-me, #205)
// - OFFER_TTL_MS - 15-minute confirmation window of a waitlist offer
// - resetMockWaitlist - clear the in-memory waitlist (test isolation)
// - resetMockCheckIns - clear in-memory check-ins (test isolation)
// - resetMockProfiles - restore the seeded friend profiles (test isolation)
// - discoverySummary - per-friend unseen places minus the demo user's check-ins, privacy-gated (mock GET /discovery, backend DiscoveryService.summary parity)
// - friendRoute - chronological unseen places of one friend; own/not-friend/hidden map to 403/404/403 (mock GET /discovery/friends/:userId/route, backend parity)
// - peopleSuggest - mockFriends matched on seeded interests or a shared upcoming event with distances from the requested coords (mock GET /people, backend PeopleService parity)
// - resetMockParticipations - restore seeded participations (test isolation)
// - createMockCheckIn - in-memory check-in for an event or a place, idempotent (mock POST)
// - achievementsFor - the four README achievements with progress derived from visit stats
// - myCityFor - my-city summary and memory points derived from the check-ins of a user
// - participationStats - per-event status counters, friends count and own status
// - calendarEntries - active bookings of a user enriched with event and place
// - todayPicks - "What to do today?" digest from fixtures (summary counters + three curated cards)
// - wheretoSuggestions - "Куда пойдём?" suggestions from upcoming fixtures (backend selectWheretoItems parity, max 5)
// - placePageFor - place social page aggregate: today events, friend visits, place rating, popularity, personal visits (mock)
// - installMockApi - intercept global fetch for /api/events, /api/places, /api/places/:id, /api/places/:id/page, /api/events/:id/rating, /api/events/:id/participation, /api/bookings and /api/bookings/:id/payment, /api/calendar, /api/waitlist[/me|/:id/confirm|/:id/decline], /api/check-ins, /api/users/:id/visit-stats, /api/users/:id/achievements, /api/users/:id/my-city, /api/profile, /api/friends[/activity|/availability], /api/gatherings[/:id|/:id/response], /api/votes[/:id[/ballots]], /api/plans[/auto|/:id/budget|/:id/expenses] and /api/we-groups[/:id[/events|/places|/archive]], /api/routes[/optimize], /api/lists[/:id[/items[/:itemId]]], /api/feed[/:id/like|comments], /api/reviews, /api/reports, /api/micro-events, /api/today, /api/whereto, /api/nearby[/free], /api/discovery[/friends/:userId/route], /api/people, /api/promotions/placements, /api/promotions/for-me, /api/organizer/events|places[/:id/publish] and PATCH /api/events|places/:id and /api/assist[/day], return a restore function
// - resetMockCampaigns - clear in-memory promo campaigns (test isolation)
// - resetMockPromotions - clear in-memory promotion campaigns (test isolation)
// - resetMockPromoCodes - clear in-memory promocodes (test isolation)
// - MOCK_ORGANIZER_PAID_EVENT_ID - seeded published paid organizer event with two frozen sales, one cancellation and four views (re-seeded idempotently by resetMockOrganizer)
// END_MODULE_MAP

import type {
  Achievement,
  AssistCriteria,
  AssistDayResponse,
  AssistPick,
  AssistQueryWrite,
  AssistResponse,
  AutoPlanProposal,
  AutoPlanTimelineEntry,
  Booking,
  BookingWithSeats,
  CheckIn,
  CreateAutoPlanWrite,
  CreateDayRouteWrite,
  CreateEvent,
  CreatePlace,
  CreatePlanExpenseWrite,
  CreateVoteWrite,
  CreateWeGroupWrite,
  DayRoute,
  DiscoveryFriendPlaces,
  DiscoveryResponse,
  Event,
  EventCategory,
  Friend,
  FriendActivityByFriend,
  FriendAvailability,
  FriendRoute,
  Gathering,
  InviteeResponse,
  LeisureMood,
  LeisureOption,
  LeisureStop,
  List,
  ListItem,
  ListPreset,
  MemoryPoint,
  MicroEvent,
  MyCitySummary,
  NearbyBucket,
  NearbyCard,
  NearbyTimeline,
  OptimizeRoute,
  Participation,
  ParticipationStatus,
  Payment,
  PeopleCandidate,
  PeopleMatchContext,
  PeopleResponse,
  Place,
  PlacePage,
  PlanBudget,
  PlanCard,
  PlanDebt,
  Profile,
  PromotionPlacements,
  Review,
  RouteLeg,
  RoutePoint,
  TargetedPromotionsResponse,
  TodayEventCard,
  TodayResponse,
  User,
  VisitStats,
  Vote,
  WaitlistEntry,
  WeGroup,
  WeGroupScreen,
  WheretoMood,
  WheretoQuery,
  WheretoResponse,
} from "@max-events/api-contracts";
import { AssistQueryWriteSchema, CreateAutoPlanWriteSchema, CreateBookingSchema, CreateDayRouteWriteSchema, CreateEventSchema, CreatePlaceSchema, CreatePlanExpenseWriteSchema, CreateVoteWriteSchema, CreateWeGroupWriteSchema, DEFAULT_PRIVACY, DEFAULT_SMART_ALERTS, EventCategorySchema, EventSchema, GatheringResponseWriteSchema, IdSchema, LeisureMoodSchema, ListPresetSchema, MicroEventSchema, ParticipationStatusSchema, ReviewSchema, StatsPeriodSchema, StorySchema, TimestampSchema, UpdateProfileSchema, VoteBallotWriteSchema, WheretoQuerySchema } from "@max-events/api-contracts";
import { CreatePromoCampaignWriteSchema, CreatePromoCodeWriteSchema, CreatePromotionWriteSchema, EarlyAccessWriteSchema, OrganizerLoginWriteSchema, RecordPageViewWriteSchema, RecordPromotionPaymentWriteSchema } from "@max-events/api-contracts";
import type { CreatePromoCampaignWrite, CreatePromoCodeWrite, CreatePromotionWrite, EventSalesReport, Organization, OrganizerEventStats, OrganizerRating, OrganizerRatingResponse, OrganizerSession, PageViewTarget, PromoCampaign, PromoCode, PromotionCampaign, RecordPageViewWrite, StatsPeriod, Story } from "@max-events/api-contracts";
import { parseEventFilters, REPORT_REASONS, type AddListItem, type CreateFeedPost, type CreateGathering, type CreateMicroEvent, type CreateReport, type CreateReview, type EventFilters, type EventRating, type FeedComment, type FeedPost, type ListItemCard, type ListSummary, type ParticipationStats, type Report } from "./client";

const PLACE_STAMP = "2026-08-01T12:00:00+03:00";

function place(input: Omit<Place, "createdAt" | "updatedAt" | "published">): Place {
  return { published: true, ...input, createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP };
}

export const mockPlaces: Place[] = [place({ id: "b0000001-0000-4000-8000-000000000001", title: "Парк Горького", address: "Крымский Вал, 9", city: "Москва", category: "park", latitude: 55.7298, longitude: 37.6019 }), place({ id: "b0000002-0000-4000-8000-000000000002", title: "ГМИИ им. А. С. Пушкина", address: "ул. Волхонка, 12", city: "Москва", category: "museum", latitude: 55.7447, longitude: 37.6055 }), place({ id: "b0000003-0000-4000-8000-000000000003", title: "«Лужники»", address: "Лужнецкая набережная, 24", city: "Москва", category: "sport", latitude: 55.7158, longitude: 37.5543 }), place({ id: "b0000004-0000-4000-8000-000000000004", title: "Депо. Москва", address: "Тверская Застава, 1", city: "Москва", category: "food", latitude: 55.7758, longitude: 37.5936 }), place({ id: "b0000005-0000-4000-8000-000000000005", title: "Фудкорт «Веранда» у Парка Горького", address: "Крымский Вал, 2", city: "Москва", category: "food", latitude: 55.7315, longitude: 37.604 })];

type EventInput = Pick<Event, "id" | "title" | "category" | "city" | "startsAt" | "isPaid" | "priceRub"> & Partial<Event>;

function event(input: EventInput): Event {
  return { published: true, description: "", placeId: null, endsAt: null, paymentUrl: null, capacity: null, chatLink: null, promoted: false, bookingOpensAt: null, weather: null, ...input };
}

/** "Today" for the place social page (P2-11-c): the demo day the today-block fixtures were curated for. */
export const MOCK_TODAY = "2026-09-12";

/** Moscow-calendar day key of an ISO timestamp (backend moscow-date parity). */
function moscowDateKey(startsAt: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(startsAt));
}

/** Early-access fixture event (#202): public booking opens in the future; booking works only with a valid promo code (backend PromoService.redeemInTransaction parity). */
export const MOCK_EARLY_ACCESS_EVENT_ID = "c0000009-0000-4000-8000-000000000009";
// ponytail: far-future window so the fixture stays "early access" regardless of the wall clock at test time
const MOCK_BOOKING_OPENS_AT = "2027-06-01T10:00:00+03:00";

export const mockEvents: Event[] = [
  event({ id: "c0000001-0000-4000-8000-000000000001", title: "Вечер Рахманинова: симфонический оркестр", description: "Программа из симфонических произведений С. В. Рахманинова в исполнении камерного оркестра. Начало в 19:00, антракт — 20 минут.", category: "afisha", city: "Москва", startsAt: "2026-09-19T19:00:00+03:00", isPaid: true, priceRub: 1800, paymentUrl: "https://tickets.example.com/rahmaninov", capacity: 300 }),
  event({ id: "c0000002-0000-4000-8000-000000000002", title: "Выставка импрессионистов из частных собраний", category: "afisha", city: "Москва", startsAt: "2026-09-19T12:00:00+03:00", endsAt: "2026-09-19T21:00:00+03:00", placeId: mockPlaces[1].id, isPaid: true, priceRub: 500, paymentUrl: "https://tickets.example.com/impressionists" }),
  event({ id: "c0000003-0000-4000-8000-000000000003", title: "Субботник в Парке Горького", description: "Приводим в порядок клумбы и дорожки центральной аллеи. Инвентарь и перчатки выдаём на месте, нужна только удобная одежда.", category: "volunteering", city: "Москва", startsAt: "2026-09-20T10:00:00+03:00", placeId: mockPlaces[0].id, isPaid: false, priceRub: null, capacity: 100, weather: { temperatureC: 12.4, condition: "облачно", conditionCode: 2, precipitationProbability: 40 } }),
  event({ id: "c0000004-0000-4000-8000-000000000004", title: "Помощь в приюте для животных", category: "volunteering", city: "Москва", startsAt: "2026-09-27T11:00:00+03:00", isPaid: false, priceRub: null, capacity: 15 }),
  event({ id: "c0000005-0000-4000-8000-000000000005", title: "Трейл-забег по Крылатским холмам", category: "sport", city: "Москва", startsAt: "2026-09-21T09:00:00+03:00", isPaid: true, priceRub: 800, paymentUrl: "https://tickets.example.com/trail-krilatskie", capacity: 200 }),
  event({ id: "c0000006-0000-4000-8000-000000000006", title: "Матч «Спартак» — «Динамо»", category: "sport", city: "Москва", startsAt: "2026-10-03T19:00:00+03:00", placeId: mockPlaces[2].id, isPaid: true, priceRub: 1500, paymentUrl: "https://tickets.example.com/spartak-dinamo" }),
  event({ id: "c0000007-0000-4000-8000-000000000007", title: "Веломаршрут по центру Москвы", category: "tourism", city: "Москва", startsAt: "2026-09-20T12:00:00+03:00", isPaid: false, priceRub: null }),
  event({ id: "c0000008-0000-4000-8000-000000000008", title: "Экскурсия по Китай-городу", category: "tourism", city: "Москва", startsAt: "2026-09-26T14:00:00+03:00", isPaid: true, priceRub: 900, paymentUrl: "https://tickets.example.com/kitay-gorod", capacity: 20 }),
  event({ id: "c0000009-0000-4000-8000-000000000009", title: "Гастрогид по «Депо»", category: "tourism", city: "Москва", startsAt: "2026-10-04T13:00:00+03:00", placeId: mockPlaces[3].id, isPaid: true, priceRub: 1200, paymentUrl: "https://tickets.example.com/gastro-depo", capacity: 25, bookingOpensAt: MOCK_BOOKING_OPENS_AT }),
  event({ id: "c000000a-0000-4000-8000-00000000000a", title: "Йога на рассвете в парке", category: "sport", city: "Москва", startsAt: "2026-09-13T08:00:00+03:00", placeId: mockPlaces[0].id, isPaid: false, priceRub: null, capacity: 50 }),
  event({ id: "c000000b-0000-4000-8000-00000000000b", title: "Кинопоказ под открытым небом", category: "afisha", city: "Москва", startsAt: "2026-09-18T21:00:00+03:00", placeId: mockPlaces[0].id, isPaid: false, priceRub: null }),
  event({ id: "c000000c-0000-4000-8000-00000000000c", title: "Гастрофестиваль в «Депо»", category: "afisha", city: "Москва", startsAt: "2026-09-27T12:00:00+03:00", endsAt: "2026-09-27T22:00:00+03:00", placeId: mockPlaces[3].id, isPaid: true, priceRub: 700, paymentUrl: "https://tickets.example.com/gastro-festival" }),
  event({ id: "c000000d-0000-4000-8000-00000000000d", title: "Прогулка-знакомство по Парку Горького", category: "tourism", city: "Москва", startsAt: "2026-09-05T10:00:00+03:00", placeId: mockPlaces[0].id, isPaid: false, priceRub: null }),
  event({ id: "c000000e-0000-4000-8000-00000000000e", title: "Открытая репетиция камерного оркестра", category: "afisha", city: "Москва", startsAt: "2026-09-08T19:00:00+03:00", isPaid: false, priceRub: null }),
  event({ id: "c000000f-0000-4000-8000-00000000000f", title: "Летний концерт на Пушкинской набережной", category: "afisha", city: "Москва", startsAt: `${MOCK_TODAY}T19:00:00+03:00`, placeId: mockPlaces[0].id, isPaid: false, priceRub: null, capacity: 200 }),
  event({ id: "c0000010-0000-4000-8000-000000000010", title: "Дневной кофе-маркет в «Депо»", category: "afisha", city: "Москва", startsAt: `${MOCK_TODAY}T12:30:00+03:00`, placeId: mockPlaces[3].id, isPaid: false, priceRub: null, promoted: true }),
  event({ id: "c0000011-0000-4000-8000-000000000011", title: "Лекция об импрессионистах", category: "afisha", city: "Москва", startsAt: `${MOCK_TODAY}T15:00:00+03:00`, placeId: mockPlaces[1].id, isPaid: false, priceRub: null }),
  // Sandbox-payment failure fixture (#213): the 13 ₽ price is the sandbox fail amount, so paying for a booking here always fails (backend SANDBOX_FAIL_AMOUNT parity).
  event({ id: "c0000012-0000-4000-8000-000000000012", title: "Утренняя настольная игра", category: "sport", city: "Москва", startsAt: "2027-03-15T10:00:00+03:00", isPaid: true, priceRub: 13, paymentUrl: "https://tickets.example.com/nastolka-13" }),
];

export function filterMockEvents(events: Event[], filters: EventFilters): Event[] {
  const city = filters.city?.toLowerCase();
  return events.filter((item) => (filters.category === undefined || item.category === filters.category) && (city === undefined || item.city.toLowerCase() === city) && (filters.date === undefined || item.startsAt.slice(0, 10) === filters.date));
}

export const mockOrganizers: User[] = [{ id: "d0000001-0000-4000-8000-000000000001", maxUserId: "organizer-1", firstName: "Анна", lastName: "Соколова", username: null, avatarUrl: null, createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP }];

/** Demo identity for mock auth outside MAX (VITE_USE_MOCK=1); the id matches the demo user id used by the booking/profile fixtures. */
export const mockDemoUser: User = { id: "a0000000-0000-4000-8000-000000000001", maxUserId: "demo", firstName: "Демо", lastName: null, username: "demo", avatarUrl: null, createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP };

/** Demo organization and its login/password for the organizer space in mock mode. */
export const mockOrganization: Organization = { id: "e0000000-0000-4000-8000-000000000001", name: "Городские события", contacts: "org@example.com" };
export const MOCK_ORGANIZER_CREDENTIALS = { login: "demo", password: "demo" } as const;

export const mockFriendIds: string[] = ["a0000000-0000-4000-8000-0000000000b1", "a0000000-0000-4000-8000-0000000000b2", "a0000000-0000-4000-8000-0000000000b3", "a0000000-0000-4000-8000-0000000000b4", "a0000000-0000-4000-8000-0000000000b5", "a0000000-0000-4000-8000-0000000000b6", "a0000000-0000-4000-8000-0000000000b7"];

/** Friend fixtures for the friends feed; avatarUrl is null so the UI renders initials avatars. */
export const mockFriends: Friend[] = [
  { id: mockFriendIds[0], name: "Анна Соколова", avatarUrl: null },
  { id: mockFriendIds[1], name: "Дима Кузнецов", avatarUrl: null },
  { id: mockFriendIds[2], name: "Катя Орлова", avatarUrl: null },
  { id: mockFriendIds[3], name: "Пётр Новиков", avatarUrl: null },
  { id: mockFriendIds[4], name: "Мария Белова", avatarUrl: null },
  { id: mockFriendIds[5], name: "Игорь Фомин", avatarUrl: null },
  { id: mockFriendIds[6], name: "Лена Гусева", avatarUrl: null },
];

/** Gradient placeholder image (data URL) for seeded story fixtures. */
function storyImage(colorFrom: string, colorTo: string, emoji: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colorFrom}"/><stop offset="1" stop-color="${colorTo}"/></linearGradient></defs><rect width="720" height="1280" fill="url(#g)"/><text x="360" y="680" font-size="220" text-anchor="middle">${emoji}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const MOCK_OWN_STORY_KEY = "max-events.mock-own-story";

/** Seeded friend stories: every friend has 1–3 stories so the rail is fully active. */
export const mockFriendStories: Story[] = [
  { id: "e1000000-0000-4000-8000-000000000001", userId: mockFriendIds[0], imageUrl: storyImage("#bf97ff", "#526eff", "🎉"), createdAt: "2026-09-16T09:00:00+03:00" },
  { id: "e1000000-0000-4000-8000-000000000002", userId: mockFriendIds[0], imageUrl: storyImage("#ffc93d", "#ff832a", "🎨"), createdAt: "2026-09-16T10:00:00+03:00" },
  { id: "e1000000-0000-4000-8000-000000000003", userId: mockFriendIds[1], imageUrl: storyImage("#14e1d5", "#03c722", "🏃"), createdAt: "2026-09-16T11:00:00+03:00" },
  { id: "e1000000-0000-4000-8000-000000000004", userId: mockFriendIds[2], imageUrl: storyImage("#ff48b6", "#ff8a35", "🎧"), createdAt: "2026-09-16T11:30:00+03:00" },
  { id: "e1000000-0000-4000-8000-000000000005", userId: mockFriendIds[2], imageUrl: storyImage("#08d7f3", "#5398ff", "🌊"), createdAt: "2026-09-16T12:00:00+03:00" },
  { id: "e1000000-0000-4000-8000-000000000006", userId: mockFriendIds[3], imageUrl: storyImage("#ffc93d", "#ff832a", "🍜"), createdAt: "2026-09-16T12:30:00+03:00" },
  { id: "e1000000-0000-4000-8000-000000000007", userId: mockFriendIds[4], imageUrl: storyImage("#bf97ff", "#526eff", "📚"), createdAt: "2026-09-16T13:00:00+03:00" },
  { id: "e1000000-0000-4000-8000-000000000008", userId: mockFriendIds[4], imageUrl: storyImage("#14e1d5", "#03c722", "🌿"), createdAt: "2026-09-16T13:30:00+03:00" },
  { id: "e1000000-0000-4000-8000-000000000009", userId: mockFriendIds[4], imageUrl: storyImage("#ff48b6", "#ff8a35", "🌅"), createdAt: "2026-09-16T14:00:00+03:00" },
  { id: "e1000000-0000-4000-8000-00000000000b", userId: mockFriendIds[5], imageUrl: storyImage("#08d7f3", "#5398ff", "🎸"), createdAt: "2026-09-16T14:30:00+03:00" },
  { id: "e1000000-0000-4000-8000-00000000000c", userId: mockFriendIds[6], imageUrl: storyImage("#ffc93d", "#ff832a", "🧘"), createdAt: "2026-09-16T15:00:00+03:00" },
];

/** Own mock story persists in localStorage so it survives reloads. */
function readOwnStory(): Story | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(MOCK_OWN_STORY_KEY);
  if (raw === null) return null;
  try {
    const parsed = StorySchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function listMockStories(): Story[] {
  const own = readOwnStory();
  return own ? [own, ...mockFriendStories] : [...mockFriendStories];
}

export function createMockStory(imageUrl: string): Story {
  const story: Story = { id: "e1000000-0000-4000-8000-00000000000a", userId: mockDemoUser.id, imageUrl, createdAt: new Date().toISOString() };
  if (typeof window !== "undefined") window.localStorage.setItem(MOCK_OWN_STORY_KEY, JSON.stringify(story));
  return story;
}

/** Friend participations seed: [friendIndex, eventIndex, status]. The showcase event has 7 friends, 4 of them looking for company. The showcase friends from README: Анна → выставка, Дима → матч, Катя → фестиваль. */
const MOCK_PARTICIPATION_SEED: [number, number, ParticipationStatus][] = [
  [0, 0, "wants_to_go"],
  [1, 0, "wants_to_go"],
  [2, 0, "going"],
  [3, 0, "looking_for_company"],
  [4, 0, "looking_for_company"],
  [5, 0, "looking_for_company"],
  [6, 0, "looking_for_company"],
  [0, 2, "going"],
  [1, 3, "looking_for_company"],
  [2, 4, "probably_going"],
  [0, 1, "going"],
  [1, 5, "going"],
  [2, 11, "going"],
  [3, 3, "looking_for_company"],
  [4, 7, "probably_going"],
  [5, 6, "looking_for_travel_buddy"],
];

const mockParticipations = new Map<string, Participation>();
let mockParticipationSeq = 0;

function seedMockParticipations(): void {
  mockParticipations.clear();
  mockParticipationSeq = 0;
  for (const [friend, eventItem, status] of MOCK_PARTICIPATION_SEED) {
    mockParticipationSeq += 1;
    mockParticipations.set(`${mockFriendIds[friend]}:${mockEvents[eventItem].id}`, { id: `f0000000-0000-4000-8000-${String(mockParticipationSeq).padStart(12, "0")}`, userId: mockFriendIds[friend], eventId: mockEvents[eventItem].id, status, createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP });
  }
  // the demo user also wants to go to the open-air cinema (Катя goes too) — backs the shared_event context of the people mock
  mockParticipationSeq += 1;
  mockParticipations.set(`${mockDemoUser.id}:${mockEvents[11].id}`, { id: `f0000000-0000-4000-8000-${String(mockParticipationSeq).padStart(12, "0")}`, userId: mockDemoUser.id, eventId: mockEvents[11].id, status: "wants_to_go", createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP });
}
seedMockParticipations();

export function resetMockParticipations(): void {
  seedMockParticipations();
}

/** Mock availability per friend (by mockFriends index); the backend P1-6-b does not exist yet. */
const MOCK_AVAILABILITY: FriendAvailability["availability"][] = ["free", "busy", "unknown", "free", "free", "busy", "unknown"];

export function friendAvailability(): FriendAvailability[] {
  return mockFriends.map((friend, index) => ({ friend, availability: MOCK_AVAILABILITY[index] }));
}

/** Deterministic invitee answer per friend (by mockFriends index): Дима accepted, Катя considering, Андрей-like busy mix. */
const MOCK_INVITEE_RESPONSE: InviteeResponse[] = ["accepted", "accepted", "considering", "busy", "accepted", "considering", "busy"];

const mockGatherings = new Map<string, Gathering>();
let mockGatheringSeq = 0;

/** Seeded deep-link demo gathering (gathering-<id>): the demo user is an invitee awaiting their answer; the host stays outside the invitee list like on the backend. */
export const MOCK_GATHERING_ID = "d0000000-0000-4000-8000-0000000000a1";

function seedMockGatherings(): void {
  mockGatherings.clear();
  mockGatheringSeq = 0;
  mockGatherings.set(MOCK_GATHERING_ID, {
    id: MOCK_GATHERING_ID,
    event: mockEvents[0],
    invitees: [
      { friend: { id: mockDemoUser.id, name: mockDemoUser.firstName, avatarUrl: null }, response: "considering" },
      { friend: mockFriends[1], response: "accepted" },
      { friend: mockFriends[2], response: "considering" },
    ],
    proposedMeetingAt: "2026-09-19T16:00:00.000Z",
    status: "awaiting_responses",
    chatLink: "https://max.ru/chat/mock-gathering-demo",
    createdAt: PLACE_STAMP,
    updatedAt: PLACE_STAMP,
  });
}

seedMockGatherings();

export function resetMockGatherings(): void {
  seedMockGatherings();
}

/** Creates an in-memory gathering: known event, known friends, valid proposed time, deterministic per-fixture responses. */
export function createMockGathering(payload: CreateGathering): Gathering | null {
  const event = mockEvents.find((item) => item.id === payload.eventId);
  if (!event || payload.friendIds.length === 0 || !payload.friendIds.every((id) => mockFriendIds.includes(id))) return null;
  if (!TimestampSchema.safeParse(payload.proposedMeetingAt).success) return null;
  const now = new Date().toISOString();
  mockGatheringSeq += 1;
  const gathering: Gathering = {
    id: `d0000000-0000-4000-8000-${String(mockGatheringSeq).padStart(12, "0")}`,
    event,
    invitees: payload.friendIds.map((id) => {
      const index = mockFriendIds.indexOf(id);
      return { friend: mockFriends[index], response: MOCK_INVITEE_RESPONSE[index] };
    }),
    proposedMeetingAt: payload.proposedMeetingAt,
    status: "awaiting_responses",
    chatLink: `https://max.ru/chat/mock-gathering-${mockGatheringSeq}`,
    createdAt: now,
    updatedAt: now,
  };
  mockGatherings.set(gathering.id, gathering);
  return gathering;
}

/** Demo-user invitee answer (backend GatheringsService.respond parity): unknown -> "unknown", host or outsider -> "forbidden". */
export function respondMockGathering(id: string, response: InviteeResponse): Gathering | "unknown" | "forbidden" {
  const gathering = mockGatherings.get(id);
  if (!gathering) return "unknown";
  const invitee = gathering.invitees.find((item) => item.friend.id === mockDemoUser.id);
  if (!invitee) return "forbidden";
  invitee.response = response;
  gathering.updatedAt = new Date().toISOString();
  return gathering;
}

/** In-memory vote row: contract fields plus option positions and raw ballots (backend vote.entity parity; option positions tie-break the winner like the backend order does). */
interface MockVoteRow {
  id: string;
  hostUserId: string;
  title: string;
  chatLink: string | null;
  participantIds: string[];
  options: { id: string; eventId: string; position: number }[];
  ballots: { userId: string; eventId: string }[];
  createdAt: string;
  updatedAt: string;
}

/** Seeded deep-link demo vote (hosted by Анна, the demo user is a participant; winner seeded with two ballots). */
export const MOCK_VOTE_ID = "d7000000-0000-4000-8000-000000000001";
/** Seeded vote the demo user can neither view nor vote on (403 parity). */
export const MOCK_FOREIGN_VOTE_ID = "d7000000-0000-4000-8000-000000000002";

const mockVotes = new Map<string, MockVoteRow>();
let mockVoteSeq = 0;

function mockVoteDto(row: MockVoteRow): Vote {
  const counts = new Map<string, number>();
  for (const ballot of row.ballots) counts.set(ballot.eventId, (counts.get(ballot.eventId) ?? 0) + 1);
  const options = [...row.options]
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    .flatMap((option) => {
      const found = mockEvents.find((item) => item.id === option.eventId);
      return found ? [{ event: found, votes: counts.get(option.eventId) ?? 0 }] : [];
    });
  const ranked = [...row.options].sort((a, b) => (counts.get(b.eventId) ?? 0) - (counts.get(a.eventId) ?? 0) || a.position - b.position || a.id.localeCompare(b.id));
  const top = ranked[0];
  const topVotes = top ? (counts.get(top.eventId) ?? 0) : 0;
  const participants: Friend[] = row.participantIds.flatMap((userId) => {
    const friend = mockFriends.find((item) => item.id === userId);
    if (friend) return [friend];
    return userId === mockDemoUser.id ? [{ id: mockDemoUser.id, name: mockDemoUser.firstName, avatarUrl: null }] : [];
  });
  return { id: row.id, hostUserId: row.hostUserId, title: row.title, chatLink: row.chatLink, participants, options, winnerEventId: top && topVotes > 0 ? top.eventId : null, myBallotEventId: row.ballots.find((ballot) => ballot.userId === mockDemoUser.id)?.eventId ?? null, createdAt: row.createdAt, updatedAt: row.updatedAt };
}

function seedMockVotes(): void {
  mockVotes.clear();
  const stamp = PLACE_STAMP;
  mockVotes.set(MOCK_VOTE_ID, {
    id: MOCK_VOTE_ID,
    hostUserId: mockFriendIds[0],
    title: "Куда идем в пятницу?",
    chatLink: "https://max.ru/chat/mock-vote-1",
    participantIds: [mockDemoUser.id, mockFriendIds[1], mockFriendIds[2]],
    // option ids deliberately run against positions so a winner tie discriminates the position tie-break from the id order
    options: [
      { id: `${MOCK_VOTE_ID}-o3`, eventId: mockEvents[0].id, position: 0 },
      { id: `${MOCK_VOTE_ID}-o2`, eventId: mockEvents[2].id, position: 1 },
      { id: `${MOCK_VOTE_ID}-o1`, eventId: mockEvents[4].id, position: 2 },
    ],
    ballots: [
      { userId: mockFriendIds[0], eventId: mockEvents[0].id },
      { userId: mockFriendIds[1], eventId: mockEvents[0].id },
      { userId: mockFriendIds[2], eventId: mockEvents[2].id },
    ],
    createdAt: stamp,
    updatedAt: stamp,
  });
  mockVotes.set(MOCK_FOREIGN_VOTE_ID, {
    id: MOCK_FOREIGN_VOTE_ID,
    hostUserId: mockFriendIds[1],
    title: "Закрытое голосование",
    chatLink: null,
    participantIds: [mockFriendIds[2]],
    options: [
      { id: `${MOCK_FOREIGN_VOTE_ID}-o1`, eventId: mockEvents[0].id, position: 0 },
      { id: `${MOCK_FOREIGN_VOTE_ID}-o2`, eventId: mockEvents[1].id, position: 1 },
    ],
    ballots: [],
    createdAt: stamp,
    updatedAt: stamp,
  });
  mockVoteSeq = 2;
}

seedMockVotes();

export function resetMockVotes(): void {
  seedMockVotes();
}

/** Creates an in-memory vote hosted by the demo user; the mock mirrors a successful MaxBot chat card (chatLink is set). */
export function createMockVote(payload: CreateVoteWrite): Vote | "invalid" | "no_event" {
  const hostUserId = mockDemoUser.id;
  const participantIds = [...new Set(payload.participantIds)];
  if (participantIds.includes(hostUserId) || participantIds.some((id) => !mockFriendIds.includes(id))) return "invalid";
  const eventIds = [...new Set(payload.eventIds)];
  const events = eventIds.map((id) => mockEvents.find((item) => item.id === id));
  if (events.some((found) => !found || found.published === false)) return "no_event";
  const now = new Date().toISOString();
  mockVoteSeq += 1;
  const id = `d7000000-0000-4000-8000-${String(mockVoteSeq).padStart(12, "0")}`;
  const row: MockVoteRow = {
    id,
    hostUserId,
    title: payload.title,
    chatLink: `https://max.ru/chat/mock-vote-${mockVoteSeq}`,
    participantIds,
    options: eventIds.map((eventId, position) => ({ id: `${id}-o${position + 1}`, eventId, position })),
    ballots: [],
    createdAt: now,
    updatedAt: now,
  };
  mockVotes.set(id, row);
  return mockVoteDto(row);
}

/** Reads a vote for the demo user: unknown -> "unknown", neither host nor participant -> "forbidden". */
export function getMockVote(id: string): Vote | "unknown" | "forbidden" {
  const row = mockVotes.get(id);
  if (!row) return "unknown";
  if (row.hostUserId !== mockDemoUser.id && !row.participantIds.includes(mockDemoUser.id)) return "forbidden";
  return mockVoteDto(row);
}

/** Casts the demo user's ballot; a repeated ballot replaces the previous one (backend castBallot parity). */
export function castMockBallot(id: string, eventId: string): Vote | "unknown" | "forbidden" | "invalid" {
  const row = mockVotes.get(id);
  if (!row) return "unknown";
  if (row.hostUserId !== mockDemoUser.id && !row.participantIds.includes(mockDemoUser.id)) return "forbidden";
  if (!row.options.some((option) => option.eventId === eventId)) return "invalid";
  const existing = row.ballots.find((ballot) => ballot.userId === mockDemoUser.id);
  if (existing) {
    existing.eventId = eventId;
  } else {
    row.ballots.push({ userId: mockDemoUser.id, eventId });
  }
  row.updatedAt = new Date().toISOString();
  return mockVoteDto(row);
}

/** Plans fixtures for the plans list and plan screens (backend P1-7-b does not exist yet); events reference mockEvents, distance is precomputed to the meeting point. */
export const mockPlans: PlanCard[] = [
  {
    plan: {
      id: "90000000-0000-4000-8000-000000000001",
      eventId: mockEvents[0].id,
      participants: [
        { friend: mockFriends[0], status: "confirmed" },
        { friend: mockFriends[1], status: "confirmed" },
        { friend: mockFriends[2], status: "invited" },
      ],
      meetingPoint: "у метро Смоленская",
      meetingAt: "2026-09-19T18:20:00+03:00",
      chatLink: "https://max.ru/chat/mock-plan-1",
      createdAt: PLACE_STAMP,
      updatedAt: PLACE_STAMP,
    },
    event: mockEvents[0],
    distanceMeters: 850,
  },
  {
    plan: {
      id: "90000000-0000-4000-8000-000000000002",
      eventId: mockEvents[2].id,
      participants: [
        { friend: mockFriends[3], status: "confirmed" },
        { friend: mockFriends[4], status: "declined" },
      ],
      meetingPoint: "у входа в Парк Горького",
      meetingAt: "2026-09-20T09:30:00+03:00",
      chatLink: null,
      createdAt: PLACE_STAMP,
      updatedAt: PLACE_STAMP,
    },
    event: mockEvents[2],
    distanceMeters: 1200,
  },
];

const MOCK_PLAN_SEED = [...mockPlans];
let mockPlanSeq = MOCK_PLAN_SEED.length;

/** Restore the seeded plan cards, dropping autoplan drafts (test isolation). */
export function resetMockPlans(): void {
  mockPlans.length = 0;
  mockPlans.push(...MOCK_PLAN_SEED);
  mockPlanSeq = MOCK_PLAN_SEED.length;
}

/** Plans of the demo user enriched with event and distance, soonest meeting first. */
export function planCards(): PlanCard[] {
  return [...mockPlans].sort((a, b) => a.plan.meetingAt.localeCompare(b.plan.meetingAt));
}

/** Single plan card by plan id, or null. */
export function planCard(id: string): PlanCard | null {
  return mockPlans.find((card) => card.plan.id === id) ?? null;
}

/** In-memory plan expense row (PlanExpenseEntity parity: createdAt stored as ISO). */
interface MockPlanExpense {
  id: string;
  planId: string;
  title: string;
  amountRub: number;
  payerUserId: string;
  shareUserIds: string[];
  createdAt: string;
}

const PLAN_ONE_ID = "90000000-0000-4000-8000-000000000001";
const PLAN_TWO_ID = "90000000-0000-4000-8000-000000000002";

const MOCK_PLAN_EXPENSE_SEED: MockPlanExpense[] = [
  { id: "96000000-0000-4000-8000-000000000001", planId: PLAN_ONE_ID, title: "Билеты", amountRub: 3600, payerUserId: mockDemoUser.id, shareUserIds: [mockDemoUser.id, mockFriendIds[0], mockFriendIds[1]], createdAt: "2026-08-01T12:00:00+03:00" },
  { id: "96000000-0000-4000-8000-000000000002", planId: PLAN_ONE_ID, title: "Кафе после концерта", amountRub: 1000, payerUserId: mockFriendIds[0], shareUserIds: [mockDemoUser.id, mockFriendIds[0], mockFriendIds[1]], createdAt: "2026-08-01T12:01:00+03:00" },
  { id: "96000000-0000-4000-8000-000000000003", planId: PLAN_TWO_ID, title: "Завтрак перед субботником", amountRub: 1001, payerUserId: mockDemoUser.id, shareUserIds: [mockDemoUser.id, mockFriendIds[3]], createdAt: "2026-08-01T12:02:00+03:00" },
  { id: "96000000-0000-4000-8000-000000000004", planId: PLAN_TWO_ID, title: "Проезд", amountRub: 300, payerUserId: mockFriendIds[3], shareUserIds: [mockDemoUser.id, mockFriendIds[3]], createdAt: "2026-08-01T12:03:00+03:00" },
];

const mockPlanExpenses: MockPlanExpense[] = [...MOCK_PLAN_EXPENSE_SEED];
let mockPlanExpenseSeq = MOCK_PLAN_EXPENSE_SEED.length;

/** Backend settleBalances parity: greedy debtor->creditor settle, debtors by balance asc/id, creditors by balance desc/id. */
function mockSettleBalances(balances: Map<string, number>): PlanDebt[] {
  const debtors = [...balances.entries()].filter(([, value]) => value < 0).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  const creditors = [...balances.entries()].filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const debts: PlanDebt[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(-debtors[i]![1], creditors[j]![1]);
    if (pay > 0) debts.push({ fromUserId: debtors[i]![0], toUserId: creditors[j]![0], amountRub: pay });
    debtors[i]![1] += pay;
    creditors[j]![1] -= pay;
    if (debtors[i]![1] === 0) i += 1;
    if (creditors[j]![1] === 0) j += 1;
  }
  return debts;
}

/** Backend budgetFromExpenses parity, incl. the remainder split rotated by the expense-id charcode offset. */
export function mockBudgetFromExpenses(rows: MockPlanExpense[], extraParty: Iterable<string> = []): PlanBudget {
  const ordered = [...rows].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id));
  const party = new Set(extraParty);
  for (const row of ordered) {
    party.add(row.payerUserId);
    for (const id of row.shareUserIds) party.add(id);
  }
  const people = [...party].sort();
  const paid = new Map(people.map((id) => [id, 0]));
  const share = new Map(people.map((id) => [id, 0]));
  for (const row of ordered) {
    paid.set(row.payerUserId, (paid.get(row.payerUserId) ?? 0) + row.amountRub);
    const ids = [...new Set(row.shareUserIds)].sort();
    if (ids.length === 0) continue;
    const n = ids.length;
    const base = Math.floor(row.amountRub / n);
    const rem = row.amountRub % n;
    const offset = [...row.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % n;
    ids.forEach((id, index) => {
      const extra = rem > 0 && (index - offset + n) % n < rem ? 1 : 0;
      share.set(id, (share.get(id) ?? 0) + base + extra);
    });
  }
  const balances = new Map(people.map((id) => [id, (paid.get(id) ?? 0) - (share.get(id) ?? 0)]));
  return {
    expenses: ordered.map((row) => ({ id: row.id, planId: row.planId, title: row.title, amountRub: row.amountRub, payerUserId: row.payerUserId, shareUserIds: [...row.shareUserIds], createdAt: row.createdAt })),
    perPerson: people.map((userId) => ({ userId, paidRub: paid.get(userId) ?? 0, shareRub: share.get(userId) ?? 0, netRub: balances.get(userId) ?? 0 })),
    debts: mockSettleBalances(balances),
    totalRub: ordered.reduce((sum, row) => sum + row.amountRub, 0),
  };
}

/** Backend spendPartyIds parity: the mock serves the demo user as the host of every seeded plan, so the party is the host + confirmed participants. */
function mockSpendPartyIds(planId: string): Set<string> {
  const card = planCard(planId);
  const confirmed = card ? card.plan.participants.filter((row) => row.status === "confirmed").map((row) => row.friend.id) : [];
  return new Set([mockDemoUser.id, ...confirmed]);
}

/** Mock GET /plans/:id/budget: 404 unknown plan; the demo user hosts every seeded plan, so canView always passes. */
export function mockPlanBudget(planId: string): PlanBudget | null {
  if (!planCard(planId)) return null;
  const rows = mockPlanExpenses.filter((row) => row.planId === planId);
  return mockBudgetFromExpenses(rows, mockSpendPartyIds(planId));
}

/** Mock POST /plans/:id/expenses (backend addExpense parity): 404 unknown plan; 400 payer/shares outside the party; the demo host may attribute payments to any party member. */
function addMockPlanExpense(planId: string, payload: CreatePlanExpenseWrite): PlanBudget | null | "invalid" {
  if (!planCard(planId)) return null;
  const party = mockSpendPartyIds(planId);
  if (!party.has(payload.payerUserId) || payload.shareUserIds.some((id) => !party.has(id))) return "invalid";
  mockPlanExpenseSeq += 1;
  mockPlanExpenses.push({ id: `96000000-0000-4000-8000-${String(mockPlanExpenseSeq).padStart(12, "0")}`, planId, title: payload.title.trim(), amountRub: payload.amountRub, payerUserId: payload.payerUserId, shareUserIds: [...new Set(payload.shareUserIds)], createdAt: new Date().toISOString() });
  return mockBudgetFromExpenses(
    mockPlanExpenses.filter((row) => row.planId === planId),
    party,
  );
}

/** In-memory «Мы» group row: the group plus its member ids and bound event/place ids. */
interface MockWeGroupRow {
  group: WeGroup;
  memberIds: string[];
  eventIds: string[];
  placeIds: string[];
}

const MOCK_WE_GROUP_SEED: MockWeGroupRow[] = [
  {
    group: { id: "91000000-0000-4000-8000-000000000001", ownerUserId: mockDemoUser.id, title: "Субботник и гастровыходные", chatLink: "https://max.ru/join/we-group-demo", status: "active", createdAt: "2026-08-01T12:00:00+03:00", updatedAt: "2026-08-01T12:00:00+03:00", archivedAt: null },
    memberIds: [mockDemoUser.id, mockFriendIds[3], mockFriendIds[4]],
    eventIds: [mockEvents[2].id],
    placeIds: [mockPlaces[3].id],
  },
  {
    group: { id: "91000000-0000-4000-8000-000000000002", ownerUserId: mockDemoUser.id, title: "Прошлый поход на выставку", chatLink: null, status: "archived", createdAt: "2026-07-01T12:00:00+03:00", updatedAt: "2026-07-02T12:00:00+03:00", archivedAt: "2026-07-02T12:00:00+03:00" },
    memberIds: [mockDemoUser.id, mockFriendIds[0]],
    eventIds: [],
    placeIds: [],
  },
  {
    group: { id: "91000000-0000-4000-8000-000000000003", ownerUserId: mockFriendIds[0], title: "Киноклуб", chatLink: null, status: "active", createdAt: "2026-07-10T12:00:00+03:00", updatedAt: "2026-07-10T12:00:00+03:00", archivedAt: null },
    memberIds: [mockFriendIds[0], mockDemoUser.id],
    eventIds: [],
    placeIds: [],
  },
  {
    group: { id: "91000000-0000-4000-8000-000000000004", ownerUserId: mockFriendIds[0], title: "Чужая группа", chatLink: null, status: "active", createdAt: "2026-07-05T12:00:00+03:00", updatedAt: "2026-07-05T12:00:00+03:00", archivedAt: null },
    memberIds: [mockFriendIds[0], mockFriendIds[1]],
    eventIds: [],
    placeIds: [],
  },
];

let mockWeGroups: MockWeGroupRow[] = MOCK_WE_GROUP_SEED.map((row) => ({ group: { ...row.group }, memberIds: [...row.memberIds], eventIds: [...row.eventIds], placeIds: [...row.placeIds] }));
let mockWeGroupSeq = MOCK_WE_GROUP_SEED.length;

/** Restore the seeded groups and plan expenses (test isolation). */
export function resetMockWeGroups(): void {
  mockWeGroups = MOCK_WE_GROUP_SEED.map((row) => ({ group: { ...row.group }, memberIds: [...row.memberIds], eventIds: [...row.eventIds], placeIds: [...row.placeIds] }));
  mockWeGroupSeq = MOCK_WE_GROUP_SEED.length;
  mockPlanExpenses.length = 0;
  mockPlanExpenses.push(...MOCK_PLAN_EXPENSE_SEED);
  mockPlanExpenseSeq = MOCK_PLAN_EXPENSE_SEED.length;
}

function mockFriendOf(userId: string): Friend {
  if (userId === mockDemoUser.id) return { id: mockDemoUser.id, name: "Демо", avatarUrl: null };
  return mockFriends.find((friend) => friend.id === userId) ?? { id: userId, name: "Участник", avatarUrl: null };
}

/** Screen aggregate (backend WeGroupsService.toScreen parity): members in join order, bound events/places from fixtures, member bookings, group route, shared plan budget, photos (no seeded photos). */
function mockWeGroupScreen(row: MockWeGroupRow): WeGroupScreen {
  const events = row.eventIds.flatMap((id) => {
    const found = mockEvents.find((item) => item.id === id && item.published !== false);
    return found ? [found] : [];
  });
  const places = row.placeIds.flatMap((id) => {
    const found = mockPlaces.find((item) => item.id === id && item.published !== false);
    return found ? [found] : [];
  });
  const memberSet = new Set([row.group.ownerUserId, ...row.memberIds]);
  const eventSet = new Set(events.map((item) => item.id));
  return {
    group: { ...row.group },
    members: row.memberIds.map(mockFriendOf),
    events,
    places,
    bookings: mockBookings.filter((booking) => booking.status === "active" && memberSet.has(booking.userId) && eventSet.has(booking.eventId)).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id)),
    route: mockWeGroupRoute(events, places),
    budget: mockWeGroupBudget(memberSet, eventSet),
    photos: [],
  };
}

/** Backend groupRoute parity: event points by startsAt, then not-yet-used extra places by id; null under two points. */
function mockWeGroupRoute(events: Event[], places: Place[]): DayRoute | null {
  const points: RoutePoint[] = [];
  const usedPlaces = new Set<string>();
  const sortedEvents = [...events].filter((row) => row.placeId !== null).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id));
  for (const event of sortedEvents) {
    const place = mockPlaces.find((item) => item.id === event.placeId);
    if (!place) continue;
    points.push({ title: event.title, at: new Date(event.startsAt).toISOString(), latitude: place.latitude, longitude: place.longitude, eventId: event.id, placeId: place.id });
    usedPlaces.add(place.id);
  }
  const extraPlaces = [...places].filter((row) => !usedPlaces.has(row.id)).sort((a, b) => a.id.localeCompare(b.id));
  for (const place of extraPlaces) {
    points.push({ title: place.title, at: null, latitude: place.latitude, longitude: place.longitude, eventId: null, placeId: place.id });
  }
  const sliced = points.slice(0, 8);
  if (sliced.length < 2) return null;
  return mockDayRoute(sliced);
}

/** Backend groupBudget parity: expenses of the demo-hosted plans bound to the group events; null without plans or expenses. */
function mockWeGroupBudget(memberSet: Set<string>, eventSet: Set<string>): PlanBudget | null {
  if (eventSet.size === 0 || !memberSet.has(mockDemoUser.id)) return null;
  const planIds = new Set(mockPlans.filter((card) => eventSet.has(card.plan.eventId)).map((card) => card.plan.id));
  if (planIds.size === 0) return null;
  const rows = mockPlanExpenses.filter((row) => planIds.has(row.planId));
  if (rows.length === 0) return null;
  return mockBudgetFromExpenses(rows);
}

function findMockWeGroup(id: string): MockWeGroupRow | null {
  return mockWeGroups.find((row) => row.group.id === id) ?? null;
}

function isMockWeGroupMember(row: MockWeGroupRow, userId: string): boolean {
  return row.group.ownerUserId === userId || row.memberIds.includes(userId);
}

/** Mock GET /we-groups: screens of the demo user's groups, newest first (backend listForUser parity). */
export function listMockWeGroups(): WeGroupScreen[] {
  return [...mockWeGroups]
    .filter((row) => isMockWeGroupMember(row, mockDemoUser.id))
    .sort((a, b) => Date.parse(b.group.createdAt) - Date.parse(a.group.createdAt) || a.group.id.localeCompare(b.group.id))
    .map(mockWeGroupScreen);
}

/** Mock GET /we-groups/:id: "unknown" -> 404, "forbidden" non-member -> 403 (backend requireMember parity). */
function getMockWeGroup(id: string): WeGroupScreen | "unknown" | "forbidden" {
  const row = findMockWeGroup(id);
  if (!row) return "unknown";
  if (!isMockWeGroupMember(row, mockDemoUser.id)) return "forbidden";
  return mockWeGroupScreen(row);
}

/** Mock POST /we-groups (backend create parity): owner always a member, every member id must be a known user. */
function createMockWeGroup(payload: CreateWeGroupWrite): WeGroupScreen | "unknown_user" {
  const known = new Set([mockDemoUser.id, ...mockFriendIds]);
  const memberIds = [...new Set([mockDemoUser.id, ...payload.memberIds])];
  if (memberIds.some((id) => !known.has(id))) return "unknown_user";
  const now = new Date().toISOString();
  mockWeGroupSeq += 1;
  const row: MockWeGroupRow = {
    group: { id: `91000000-0000-4000-8000-${String(mockWeGroupSeq).padStart(12, "0")}`, ownerUserId: mockDemoUser.id, title: payload.title.trim(), chatLink: `https://max.ru/join/we-group-${mockWeGroupSeq}`, status: "active", createdAt: now, updatedAt: now, archivedAt: null },
    memberIds,
    eventIds: [],
    placeIds: [],
  };
  mockWeGroups.push(row);
  return mockWeGroupScreen(row);
}

/** Mock POST /we-groups/:id/events|places (backend addEvent/addPlace parity): duplicate binds are idempotent; "archived" -> 409. */
function bindMockWeGroupItem(id: string, kind: "event" | "place", itemId: string): WeGroupScreen | "unknown" | "forbidden" | "archived" | "no_target" {
  const row = findMockWeGroup(id);
  if (!row) return "unknown";
  if (!isMockWeGroupMember(row, mockDemoUser.id)) return "forbidden";
  if (row.group.status === "archived") return "archived";
  if (kind === "event") {
    if (!mockEvents.some((item) => item.id === itemId && item.published !== false)) return "no_target";
    if (!row.eventIds.includes(itemId)) row.eventIds.push(itemId);
  } else {
    if (!mockPlaces.some((item) => item.id === itemId && item.published !== false)) return "no_target";
    if (!row.placeIds.includes(itemId)) row.placeIds.push(itemId);
  }
  return mockWeGroupScreen(row);
}

/** Mock POST /we-groups/:id/archive (backend archive parity): owner only, idempotent. */
function archiveMockWeGroup(id: string): WeGroupScreen | "unknown" | "forbidden" {
  const row = findMockWeGroup(id);
  if (!row) return "unknown";
  if (!isMockWeGroupMember(row, mockDemoUser.id)) return "forbidden";
  if (row.group.ownerUserId !== mockDemoUser.id) return "forbidden";
  if (row.group.status !== "archived") {
    const now = new Date().toISOString();
    row.group.status = "archived";
    row.group.archivedAt = now;
    row.group.updatedAt = now;
  }
  return mockWeGroupScreen(row);
}

/** Preset list titles per ListPreset; the lists UI renders List.title as-is. */
export const LIST_PRESET_TITLES: Record<ListPreset, string> = {
  want_to_go: "Хочу сходить",
  favorites: "Избранное",
  weekend: "На выходные",
  with_children: "С детьми",
  with_friends: "С друзьями",
  try_later: "Попробовать потом",
};

/** Preset list items seeded on list creation: [preset, mockEvents index]. */
const MOCK_LIST_SEED: [ListPreset, number][] = [
  ["want_to_go", 0],
  ["favorites", 1],
];

const mockLists = new Map<string, List[]>();
const mockListItems: ListItem[] = [];
const mockListItemAuthors = new Map<string, Friend>();
let mockListSeq = 0;
let mockListItemSeq = 0;

export function resetMockLists(): void {
  mockLists.clear();
  mockListItems.length = 0;
  mockListItemAuthors.clear();
  mockListSeq = 0;
  mockListItemSeq = 0;
}

/** The seeded shared collection of the demo user and the first friend; both add items, «Отправить в чат» shares it. */
const SHARED_LIST_ID = "70000000-0000-4000-8000-0000000000c0";
export const SHARED_COLLECTION_TITLE = "Совместное: идеи на выходные";

const SHARED_LIST_PARTICIPANTS = (): Friend[] => [{ id: mockDemoUser.id, name: "Демо", avatarUrl: null }, mockFriends[0]];

/** Seeded shared-collection items: [mockEvents index, author friend index] (the demo user is index -1). */
const MOCK_SHARED_LIST_SEED: [number, number][] = [
  [6, -1],
  [7, 0],
];

function listItem(listId: string, eventId: string, addedBy: Friend | null = null): ListItem {
  mockListItemSeq += 1;
  const item: ListItem = { id: `71000000-0000-4000-8000-${String(mockListItemSeq).padStart(12, "0")}`, listId, eventId, placeId: null, addedAt: PLACE_STAMP };
  if (addedBy !== null) mockListItemAuthors.set(item.id, addedBy);
  return item;
}

/** The six preset lists of a user plus the shared collection for its participants, created with their seed items on first request. */
function listsFor(userId: string): List[] {
  let lists = mockLists.get(userId);
  if (lists) return lists;
  lists = ListPresetSchema.options.map((preset) => {
    mockListSeq += 1;
    return { id: `70000000-0000-4000-8000-${String(mockListSeq).padStart(12, "0")}`, userId, preset, title: LIST_PRESET_TITLES[preset], createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP };
  });
  for (const [preset, eventIndex] of MOCK_LIST_SEED) {
    const list = lists.find((candidate) => candidate.preset === preset);
    if (list) mockListItems.push(listItem(list.id, mockEvents[eventIndex].id));
  }
  if (userId === mockDemoUser.id || userId === mockFriendIds[0]) {
    lists.push({ id: SHARED_LIST_ID, userId, preset: null, title: SHARED_COLLECTION_TITLE, createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP });
    if (!mockListItems.some((item) => item.listId === SHARED_LIST_ID)) {
      for (const [eventIndex, authorIndex] of MOCK_SHARED_LIST_SEED) {
        mockListItems.push(listItem(SHARED_LIST_ID, mockEvents[eventIndex].id, authorIndex === -1 ? SHARED_LIST_PARTICIPANTS()[0] : mockFriends[authorIndex]));
      }
    }
  }
  mockLists.set(userId, lists);
  return lists;
}

function findList(listId: string): List | undefined {
  for (const lists of mockLists.values()) {
    const found = lists.find((list) => list.id === listId);
    if (found) return found;
  }
  return undefined;
}

/** Preset lists of a user with item counters, shared-collection participants; savedItemId points at the item saving eventId (null when not saved). */
export function listSummaries(userId: string, eventId: string | null): ListSummary[] {
  return listsFor(userId).map((list) => {
    const items = mockListItems.filter((item) => item.listId === list.id);
    return { list, itemsCount: items.length, savedItemId: items.find((item) => item.eventId === eventId)?.id ?? null, participants: list.id === SHARED_LIST_ID ? SHARED_LIST_PARTICIPANTS() : [] };
  });
}

/** Items of one list enriched with their events and the participant who added them (null outside shared collections), newest first; null for an unknown list. */
export function listItemCards(listId: string): ListItemCard[] | null {
  if (!findList(listId)) return null;
  return mockListItems
    .filter((item) => item.listId === listId && item.eventId !== null)
    .flatMap((item) => {
      const event = mockEvents.find((candidate) => candidate.id === item.eventId);
      return event ? [{ item, event, addedBy: mockListItemAuthors.get(item.id) ?? null }] : [];
    })
    .reverse();
}

/** One-list aggregate for the list screen: the list, its participants (shared collections) and its item cards; null for an unknown list. */
function listScreen(listId: string): { list: List; participants: Friend[]; items: ListItemCard[] } | null {
  const list = findList(listId);
  if (!list) return null;
  return { list, participants: list.id === SHARED_LIST_ID ? SHARED_LIST_PARTICIPANTS() : [], items: listItemCards(listId) ?? [] };
}

/** Adds an event to a list, idempotent, attributed to the adding user; "no_list"/"no_event" map to 404 in the interceptor. */
function addMockListItem(listId: string, payload: AddListItem): ListItem | "no_list" | "no_event" {
  if (!findList(listId)) return "no_list";
  if (!mockEvents.some((event) => event.id === payload.eventId)) return "no_event";
  const existing = mockListItems.find((item) => item.listId === listId && item.eventId === payload.eventId);
  if (existing) return existing;
  const item = listItem(listId, payload.eventId, mockUserAsFriend(payload.userId));
  mockListItems.push(item);
  return item;
}

/** Removes an item from a list; null when the list or the item is unknown. */
function removeMockListItem(listId: string, itemId: string): ListItem | null {
  const index = mockListItems.findIndex((item) => item.listId === listId && item.id === itemId);
  if (index === -1) return null;
  return mockListItems.splice(index, 1)[0];
}

type ReviewSeed = { friend: number; event: number; stars: number; categoryScores?: Review["categoryScores"]; wouldGoAgain: boolean; text?: string };

/** Seeded friend reviews for the showcase event and the park place events so both pages show aggregates out of the box. */
const MOCK_REVIEW_SEED: ReviewSeed[] = [
  { friend: 0, event: 0, stars: 5, categoryScores: { atmosphere: 5, organization: 5, price: 4, place: 5 }, wouldGoAgain: true, text: "Атмосфера замечательная, обязательно приду снова!" },
  { friend: 1, event: 0, stars: 4, categoryScores: { atmosphere: 4, organization: 5, price: 3, place: 4 }, wouldGoAgain: true },
  { friend: 2, event: 0, stars: 5, categoryScores: { atmosphere: 5, organization: 4 }, wouldGoAgain: false, text: "Всё понравилось, но пришлось долго искать вход." },
  { friend: 3, event: 12, stars: 4, categoryScores: { atmosphere: 4, place: 4 }, wouldGoAgain: true, text: "Парк отличное место для прогулок." },
  { friend: 4, event: 2, stars: 5, categoryScores: { atmosphere: 5, place: 5 }, wouldGoAgain: true },
];

const mockReviews: Review[] = [];
let mockReviewSeq = 0;

function seedMockReviews(): void {
  mockReviews.length = 0;
  mockReviewSeq = 0;
  for (const seed of MOCK_REVIEW_SEED) {
    mockReviewSeq += 1;
    mockReviews.push({ id: `80000000-0000-4000-8000-${String(mockReviewSeq).padStart(12, "0")}`, userId: mockFriendIds[seed.friend], eventId: mockEvents[seed.event].id, placeId: null, stars: seed.stars, categoryScores: seed.categoryScores ?? {}, wouldGoAgain: seed.wouldGoAgain, photos: [], text: seed.text ?? null, createdAt: PLACE_STAMP });
  }
}
seedMockReviews();

export function resetMockReviews(): void {
  seedMockReviews();
}

/** Rating summary and per-category averages for an event from the mock reviews; null for an unknown event. */
export function eventRating(eventId: string): EventRating | null {
  if (!mockEvents.some((item) => item.id === eventId)) return null;
  const reviews = mockReviews.filter((item) => item.eventId === eventId);
  const averageStars = reviews.length === 0 ? 0 : reviews.reduce((sum, item) => sum + item.stars, 0) / reviews.length;
  const categoryAverage = (category: keyof Review["categoryScores"]): number | null => {
    const scores = reviews.flatMap((item) => (item.categoryScores[category] === undefined ? [] : [item.categoryScores[category]!]));
    return scores.length === 0 ? null : scores.reduce((sum, score) => sum + score, 0) / scores.length;
  };
  return {
    summary: { eventId, placeId: null, averageStars, reviewsCount: reviews.length },
    categoryAverages: { atmosphere: categoryAverage("atmosphere"), organization: categoryAverage("organization"), price: categoryAverage("price"), place: categoryAverage("place") },
  };
}

/** Creates or replaces the review of a user for an event (one review per user and event); "no_event"/"invalid" map to 404/400 in the interceptor. */
function createMockReview(payload: CreateReview): Review | "no_event" | "invalid" {
  if (!mockEvents.some((item) => item.id === payload.eventId)) return "no_event";
  mockReviewSeq += 1;
  const review: Review = { id: `80000000-0000-4000-8000-${String(mockReviewSeq).padStart(12, "0")}`, userId: payload.userId, eventId: payload.eventId, placeId: null, stars: payload.stars, categoryScores: payload.categoryScores ?? {}, wouldGoAgain: payload.wouldGoAgain, photos: [], text: payload.text ?? null, createdAt: new Date().toISOString() };
  if (!ReviewSchema.safeParse(review).success) return "invalid";
  const existing = mockReviews.findIndex((item) => item.userId === payload.userId && item.eventId === payload.eventId);
  if (existing !== -1) {
    mockReviews[existing] = review;
    return review;
  }
  mockReviews.push(review);
  return review;
}

const mockReports: Report[] = [];
let mockReportSeq = 0;

export function resetMockReports(): void {
  mockReports.length = 0;
  mockReportSeq = 0;
}

/** Creates a report for exactly one known event/place/feed post; a repeat report of the same user for the same target returns "duplicate" (mock 409), 0 or >1 targets — "invalid", an unknown target or reason — "no_target"/"invalid". */
export function createMockReport(payload: CreateReport): Report | "duplicate" | "no_target" | "invalid" {
  const targetCount = [payload.eventId, payload.placeId, payload.feedPostId].filter((id) => id !== undefined).length;
  if (targetCount !== 1) return "invalid";
  const targetType = payload.eventId !== undefined ? "event" : payload.placeId !== undefined ? "place" : "feed_post";
  const targetId = payload.eventId ?? payload.placeId ?? payload.feedPostId!;
  const known = payload.eventId !== undefined ? mockEvents.some((item) => item.id === payload.eventId) : payload.placeId !== undefined ? mockPlaces.some((item) => item.id === payload.placeId) : mockFeedPosts.some((item) => item.id === payload.feedPostId);
  if (!known) return "no_target";
  if (!REPORT_REASONS.includes(payload.reason)) return "invalid";
  if (mockReports.some((item) => item.userId === payload.userId && item.targetId === targetId)) return "duplicate";
  mockReportSeq += 1;
  const report: Report = { id: `81000000-0000-4000-8000-${String(mockReportSeq).padStart(12, "0")}`, userId: payload.userId, targetType, targetId, reason: payload.reason, status: "open", source: "user", createdAt: new Date().toISOString() };
  mockReports.push(report);
  return report;
}

type MicroEventSeed = Omit<MicroEvent, "createdAt">;

const MICRO_EVENT_SEED: MicroEventSeed[] = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    authorId: mockFriendIds[0],
    title: "Играем в баскетбол",
    startsAt: "2026-09-19T19:00:00+03:00",
    locationText: "Стритбол-площадка у Парка Горького",
    placeId: null,
    participantsLimit: 6,
    participantsCount: 3,
    participantIds: [mockFriendIds[0], mockFriendIds[1], mockFriendIds[2]],
    status: "open",
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    authorId: mockFriendIds[1],
    title: "Прогулка по Парку Горького",
    startsAt: "2026-09-20T14:00:00+03:00",
    locationText: null,
    placeId: mockPlaces[0].id,
    participantsLimit: 4,
    participantsCount: 2,
    participantIds: [mockFriendIds[1], mockFriendIds[3]],
    status: "open",
  },
];

const mockMicroEvents: MicroEvent[] = [];
const mockMicroMemberships = new Set<string>();
let mockMicroSeq = 0;

function seedMockMicroEvents(): void {
  mockMicroEvents.length = 0;
  mockMicroMemberships.clear();
  mockMicroSeq = MICRO_EVENT_SEED.length;
  for (const seed of MICRO_EVENT_SEED) {
    mockMicroEvents.push({ ...seed, participantIds: [...seed.participantIds], createdAt: PLACE_STAMP });
    for (const participant of seed.participantIds) mockMicroMemberships.add(`${participant}:${seed.id}`);
  }
}
seedMockMicroEvents();

export function resetMockMicroEvents(): void {
  seedMockMicroEvents();
}

/** Open micro events soonest first. */
export function microEvents(): MicroEvent[] {
  return [...mockMicroEvents].filter((item) => item.status === "open").sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Creates a micro event from the UGC form; the author counts as the first participant; "no_place"/"invalid" map to 404/400 in the interceptor. */
export function createMockMicroEvent(payload: CreateMicroEvent): MicroEvent | "no_place" | "invalid" {
  if (payload.userId === "") return "invalid";
  const placeId = payload.placeId ?? null;
  if (placeId !== null && !mockPlaces.some((item) => item.id === placeId)) return "no_place";
  mockMicroSeq += 1;
  const candidate: MicroEvent = {
    id: `20000000-0000-4000-8000-${String(mockMicroSeq).padStart(12, "0")}`,
    authorId: payload.userId,
    title: payload.title,
    startsAt: payload.startsAt,
    locationText: payload.locationText ?? null,
    placeId,
    participantsLimit: payload.participantsLimit,
    participantsCount: 1,
    participantIds: [payload.userId],
    status: "open",
    createdAt: new Date().toISOString(),
  };
  if (!MicroEventSchema.safeParse(candidate).success) return "invalid";
  mockMicroEvents.push(candidate);
  mockMicroMemberships.add(`${payload.userId}:${candidate.id}`);
  return candidate;
}

/** Joins an open micro event; already-joined is idempotent, a full or cancelled one — "full"/"closed" (mock 409). */
export function joinMockMicroEvent(id: string, userId: string): MicroEvent | null | "full" | "closed" {
  const target = mockMicroEvents.find((item) => item.id === id);
  if (!target) return null;
  const key = `${userId}:${id}`;
  if (target.status === "cancelled") return "closed";
  if (mockMicroMemberships.has(key)) return target;
  if (target.participantsCount >= target.participantsLimit) return "full";
  target.participantsCount += 1;
  target.participantIds = [...target.participantIds, userId].sort();
  mockMicroMemberships.add(key);
  return target;
}

/** Leaves a micro event; not-joined is idempotent, an unknown one — null (mock 404). */
export function leaveMockMicroEvent(id: string, userId: string): MicroEvent | null {
  const target = mockMicroEvents.find((item) => item.id === id);
  if (!target) return null;
  if (mockMicroMemberships.delete(`${userId}:${id}`)) {
    target.participantsCount -= 1;
    target.participantIds = target.participantIds.filter((item) => item !== userId);
  }
  return target;
}

type FeedSeed = { author: number; event: number; text: string; likes: number; comments?: { author: number; text: string }[] };

/** Seeded impression posts (Instagram-style feed); the photo is a CSS placeholder, authors are friends. */
const MOCK_FEED_SEED: FeedSeed[] = [
  { author: 0, event: 1, text: "Выставка впечатляет — очередь к картине на входе.", likes: 3, comments: [{ author: 1, text: "Тоже иду на выходных!" }] },
  { author: 1, event: 5, text: "Матч был огонь, трибуны горели до финального свистка.", likes: 1 },
  { author: 2, event: 11, text: "Гастрофестиваль: обязательно попробуйте сырные ряды.", likes: 2, comments: [{ author: 0, text: "Скинь фото сырной лавки" }] },
];

const mockFeedPosts: FeedPost[] = [];
const mockFeedLikes = new Set<string>();
let mockFeedSeq = 0;
let mockFeedCommentSeq = 0;

function seedMockFeed(): void {
  mockFeedPosts.length = 0;
  mockFeedLikes.clear();
  mockFeedCommentSeq = 0;
  MOCK_FEED_SEED.forEach((seed, index) => {
    mockFeedSeq = index + 1;
    mockFeedPosts.push({
      id: `30000000-0000-4000-8000-${String(mockFeedSeq).padStart(12, "0")}`,
      author: mockFriends[seed.author],
      eventId: mockEvents[seed.event].id,
      text: seed.text,
      photoUrl: null,
      likesCount: seed.likes,
      likedByMe: false,
      comments: (seed.comments ?? []).map((comment) => {
        mockFeedCommentSeq += 1;
        return { id: `31000000-0000-4000-8000-${String(mockFeedCommentSeq).padStart(12, "0")}`, author: mockFriends[comment.author], text: comment.text };
      }),
    });
  });
}
seedMockFeed();

export function resetMockFeed(): void {
  seedMockFeed();
}

function mockUserAsFriend(userId: string): FeedPost["author"] {
  return mockFriends.find((friend) => friend.id === userId) ?? { id: userId, name: "Демо", avatarUrl: null };
}

/** Impression posts newest first; with an eventId — only the posts of that event (the event wall). */
export function feedPosts(eventId: string | null, placeId: string | null = null): FeedPost[] {
  const newestFirst = [...mockFeedPosts].reverse();
  if (eventId !== null) return newestFirst.filter((post) => post.eventId === eventId);
  if (placeId === null) return newestFirst;
  // The wall of a place is the posts of the events held there, same as the server computes it.
  const atPlace = new Set(mockEvents.filter((event) => event.placeId === placeId).map((event) => event.id));
  return newestFirst.filter((post) => atPlace.has(post.eventId));
}

/** Likes/unlikes a post as the user; the returned post carries the new counter and state; null for an unknown post. */
function toggleMockFeedLike(postId: string, userId: string): FeedPost | null {
  const post = mockFeedPosts.find((item) => item.id === postId);
  if (!post) return null;
  const key = `${userId}:${postId}`;
  if (mockFeedLikes.has(key)) {
    mockFeedLikes.delete(key);
    post.likesCount -= 1;
    post.likedByMe = false;
  } else {
    mockFeedLikes.add(key);
    post.likesCount += 1;
    post.likedByMe = true;
  }
  return post;
}

/** Appends a comment attributed to its author; null for an unknown post (mock 404). */
function addMockFeedComment(postId: string, payload: { userId: string; text: string }): FeedPost | null {
  const post = mockFeedPosts.find((item) => item.id === postId);
  if (!post) return null;
  mockFeedCommentSeq += 1;
  const comment: FeedComment = { id: `31000000-0000-4000-8000-${String(mockFeedCommentSeq).padStart(12, "0")}`, author: mockUserAsFriend(payload.userId), text: payload.text };
  post.comments.push(comment);
  return post;
}

/** Publishes an impression post as its author; null for an unknown event (mock 404). */
function createMockFeedPost(payload: CreateFeedPost): FeedPost | null {
  if (!mockEvents.some((event) => event.id === payload.eventId)) return null;
  mockFeedSeq += 1;
  const post: FeedPost = { id: `30000000-0000-4000-8000-${String(mockFeedSeq).padStart(12, "0")}`, author: mockUserAsFriend(payload.userId), eventId: payload.eventId, text: payload.text, photoUrl: payload.photoUrl ?? null, likesCount: 0, likedByMe: false, comments: [] };
  mockFeedPosts.push(post);
  return post;
}

/** Friends feed grouped by friend: every friend with the events they attend, soonest event first, groups by soonest event. */
export function friendActivityByFriend(): FriendActivityByFriend[] {
  const byFriend = new Map<string, FriendActivityByFriend>();
  for (const friend of mockFriends) byFriend.set(friend.id, { friend, events: [] });
  for (const record of mockParticipations.values()) {
    const group = byFriend.get(record.userId);
    const event = mockEvents.find((item) => item.id === record.eventId);
    if (!group || !event) continue;
    group.events.push({ event, participationStatus: record.status });
  }
  const groups = [...byFriend.values()].filter((group) => group.events.length > 0);
  for (const group of groups) group.events.sort((a, b) => a.event.startsAt.localeCompare(b.event.startsAt));
  return groups.sort((a, b) => a.events[0].event.startsAt.localeCompare(b.events[0].event.startsAt));
}

export function participationStats(eventId: string, userId: string): ParticipationStats {
  const counts: Record<ParticipationStatus, number> = { wants_to_go: 0, probably_going: 0, going: 0, looking_for_company: 0, looking_for_travel_buddy: 0, looking_for_after_event_company: 0 };
  let friendsCount = 0;
  for (const record of mockParticipations.values()) {
    if (record.eventId !== eventId) continue;
    counts[record.status] += 1;
    if (record.userId !== userId && mockFriendIds.includes(record.userId)) friendsCount += 1;
  }
  const mine = mockParticipations.get(`${userId}:${eventId}`);
  return { counts, friendsCount, myStatus: mine?.status ?? null };
}

const mockBookings: Booking[] = [];
let mockBookingSeq = 0;

const mockPayments: Payment[] = [];
let mockPaymentSeq = 0;

/** Sandbox fail amount (backend SANDBOX_FAIL_AMOUNT parity): a charge of exactly this sum is declined, as is a title containing "[fail]". */
export const MOCK_SANDBOX_FAIL_AMOUNT = 13;

/** Mirrors PaymentsService.ensureForBooking: the payment of a booking is created once (pending at booking time) and then returned as-is; free/unpriced events have none. */
function ensureMockPayment(booking: Booking, now: string): Payment | null {
  const event = mockEvents.find((item) => item.id === booking.eventId);
  if (!event || !event.isPaid || event.priceRub === null || event.priceRub <= 0) return null;
  const existing = mockPayments.find((item) => item.bookingId === booking.id);
  if (existing) return existing;
  mockPaymentSeq += 1;
  const payment: Payment = {
    id: `70000000-0000-4000-8000-${String(mockPaymentSeq).padStart(12, "0")}`,
    bookingId: booking.id,
    providerPaymentId: `pay_sandbox_${booking.id}`,
    status: "pending",
    amountRub: event.priceRub,
    currency: "RUB",
    description: `Билет: ${event.title}`,
    commissionRub: null,
    netRub: null,
    commissionBps: null,
    commissionFixedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  mockPayments.push(payment);
  return payment;
}

/** 10% platform fee frozen when a mock payment settles (backend DEFAULT_COMMISSION_BPS / freezeCommission parity). */
const MOCK_COMMISSION_BPS = 1000;

/** Mirrors the sandbox charge rule: a pending payment resolves to failed at the fail amount (or a "[fail]" title marker), otherwise succeeded; settled payments stay untouched. A succeeded charge freezes the commission once (backend freezeCommission parity). */
function settleMockPayment(payment: Payment, now: string): Payment {
  if (payment.status !== "pending") return payment;
  const event = mockEvents.find((item) => item.id === (mockBookings.find((booking) => booking.id === payment.bookingId)?.eventId ?? ""));
  payment.status = payment.amountRub === MOCK_SANDBOX_FAIL_AMOUNT || (event?.title.includes("[fail]") ?? false) ? "failed" : "succeeded";
  payment.updatedAt = now;
  if (payment.status === "succeeded" && payment.commissionFixedAt === null) {
    payment.commissionBps = MOCK_COMMISSION_BPS;
    payment.commissionRub = Math.floor((payment.amountRub * MOCK_COMMISSION_BPS) / 10_000);
    payment.netRub = payment.amountRub - payment.commissionRub;
    payment.commissionFixedAt = now;
  }
  return payment;
}

/** BookingWithSeats response shape (backend toBookingDto + payment parity). */
function mockBookingWithSeats(booking: Booking): BookingWithSeats {
  const event = mockEvents.find((item) => item.id === booking.eventId);
  return {
    ...booking,
    freeSeats: remainingSeats(booking.eventId),
    chatLink: event?.chatLink ?? null,
    payment: mockPayments.find((item) => item.bookingId === booking.id) ?? null,
  };
}

/** Module-load seed: active booking of the demo user on a past fixture event, so the post-event review flow ("Как прошло?") is reachable in the demo; test resets clear it. */
function seedMockBookings(): void {
  mockBookingSeq += 1;
  mockBookings.push({ id: `e0000000-0000-4000-8000-${String(mockBookingSeq).padStart(12, "0")}`, userId: mockDemoUser.id, eventId: "c000000d-0000-4000-8000-00000000000d", status: "active", createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP });
}
seedMockBookings();

export function resetMockBookings(): void {
  mockBookings.length = 0;
  mockBookingSeq = 0;
  mockPayments.length = 0;
  mockPaymentSeq = 0;
}

interface MockPageView {
  userId: string;
  targetType: PageViewTarget;
  targetId: string;
  viewedOn: string;
}

const mockPageViews: MockPageView[] = [];

/** Records a page view with per-user per-target per-day dedup (backend StatsService.recordView 23505 parity); the mock has no auth token, so the viewer is the demo user. */
function recordMockPageView(userId: string, payload: RecordPageViewWrite, now: Date = new Date()): { recorded: boolean } {
  const viewedOn = moscowDateKey(now.toISOString());
  if (mockPageViews.some((view) => view.userId === userId && view.targetType === payload.targetType && view.targetId === payload.targetId && view.viewedOn === viewedOn)) return { recorded: false };
  mockPageViews.push({ userId, targetType: payload.targetType, targetId: payload.targetId, viewedOn });
  return { recorded: true };
}

/** Unlimited promo code seeded for the early-access fixture event. */
export const MOCK_PROMO_CODE = "VIP2026";
/** Single-use promo code seeded for the early-access fixture event (the exhausted path). */
export const MOCK_SINGLE_USE_PROMO_CODE = "LAST1";

interface MockPromoCode {
  eventId: string;
  code: string;
  maxRedemptions: number | null;
  redeemedCount: number;
  expiresAt: string | null;
}

const mockPromoCodes: MockPromoCode[] = [];

function seedMockPromoCodes(): void {
  mockPromoCodes.length = 0;
  mockPromoCodes.push({ eventId: MOCK_EARLY_ACCESS_EVENT_ID, code: MOCK_PROMO_CODE, maxRedemptions: null, redeemedCount: 0, expiresAt: null });
  mockPromoCodes.push({ eventId: MOCK_EARLY_ACCESS_EVENT_ID, code: MOCK_SINGLE_USE_PROMO_CODE, maxRedemptions: 1, redeemedCount: 0, expiresAt: null });
}
seedMockPromoCodes();

/** Restore the seeded promo codes and their redemption counters (test isolation). */
export function resetMockPromo(): void {
  seedMockPromoCodes();
}

/** Backend PromoService.redeemInTransaction parity: no window and no code pass; a window without a code, an unknown/expired/exhausted code are forbidden (403 in the interceptor). */
function redeemMockPromoCode(eventId: string, rawCode: string | null | undefined, now: Date = new Date()): { applied: string | null } | "forbidden" {
  const early = eventId === MOCK_EARLY_ACCESS_EVENT_ID && now.getTime() < new Date(MOCK_BOOKING_OPENS_AT).getTime();
  const code = rawCode?.trim().toUpperCase();
  if (!early && !code) return { applied: null };
  if (!code) return "forbidden";
  const row = mockPromoCodes.find((item) => item.eventId === eventId && item.code === code);
  if (!row) return "forbidden";
  if (row.expiresAt !== null && new Date(row.expiresAt).getTime() <= now.getTime()) return "forbidden";
  if (row.maxRedemptions !== null && row.redeemedCount >= row.maxRedemptions) return "forbidden";
  row.redeemedCount += 1;
  return { applied: code };
}

/** Promotion placements fixture (mock GET /promotions/placements): two banners, one pin, boosted ids; placement events carry promoted=true (backend PromotionService.placements parity). */
export function mockPromotionPlacements(): PromotionPlacements {
  const promoted = (item: Event): Event => ({ ...item, promoted: true });
  return {
    banners: [mockEvents[0], mockEvents[5]].map(promoted),
    pins: [{ event: promoted(mockEvents[2]), place: mockPlaces[0] }],
    boostedEventIds: [mockEvents[7].id],
  };
}

/** Event ids with a placement campaign (banner/pin/boost): the mock /api/events listing flags them promoted (backend EventsService.list promotedEventIds parity). */
const MOCK_PLACEMENT_PROMOTED_IDS: ReadonlySet<string> = (() => {
  const placements = mockPromotionPlacements();
  return new Set([...placements.banners.map((item) => item.id), ...placements.pins.map((pin) => pin.event.id), ...placements.boostedEventIds]);
})();

/** Event ids with an active boost placement: the /api/events listing sorts these first (backend EventsService.list boosted-first parity). */
const MOCK_BOOSTED_EVENT_IDS: ReadonlySet<string> = new Set(mockPromotionPlacements().boostedEventIds);

/** Promoted-flag default: a placement event that is not already promoted fixture-wise carries promoted=true (backend promotedEventIds parity, applied in the listing, GET /events/:id and event details). */
const eventPromoted = (item: Event): Event => (MOCK_PLACEMENT_PROMOTED_IDS.has(item.id) && !item.promoted ? { ...item, promoted: true } : item);

/** Targeted collection fixture (mock GET /promotions/for-me): one target_collection row for the open-air cinema; the visit count in the explanation is derived from the demo user's mock check-in history (backend targetedFor parity). */
export function mockTargetedPromotions(): TargetedPromotionsResponse {
  const event = mockEvents[10];
  const visits = visitStatsFor(mockDemoUser.id).byCategory.find((row) => row.category === event.category)?.count ?? 0;
  return {
    collections: [
      {
        campaign: { id: "d1000000-0000-4000-8000-000000000001", eventId: event.id, type: "target_collection", status: "active", startsAt: `${MOCK_TODAY}T00:00:00+03:00`, endsAt: "2026-12-31T23:59:59+03:00", audience: { minVisits: 1, windowDays: 30, category: event.category }, createdAt: PLACE_STAMP, completedAt: null },
        event: { ...event, promoted: true },
        explanation: `${visits} посещений категории «афиша» за 30 дней`,
      },
    ],
  };
}

/** Confirmation window of a waitlist offer (mirrors the backend OFFER_TTL_MS). */
export const OFFER_TTL_MS = 15 * 60 * 1000;

const mockWaitlist: WaitlistEntry[] = [];
let mockWaitlistSeq = 0;

export function resetMockWaitlist(): void {
  mockWaitlist.length = 0;
  mockWaitlistSeq = 0;
}

/** Queue entries of an event (waiting|offered) in FIFO order. */
function waitlistQueue(eventId: string): WaitlistEntry[] {
  return mockWaitlist.filter((entry) => entry.eventId === eventId && (entry.status === "waiting" || entry.status === "offered")).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function withWaitlistPosition(entry: WaitlistEntry): WaitlistEntry {
  const queue = waitlistQueue(entry.eventId);
  const index = queue.findIndex((item) => item.id === entry.id);
  return { ...entry, position: index === -1 ? queue.length + 1 : index + 1 };
}

/** Offers a freed seat to the first waiting entry (15-minute confirmation window); the offered seat stays reserved. */
function offerNextMockWaitlist(eventId: string, now: Date): void {
  const next = waitlistQueue(eventId).find((entry) => entry.status === "waiting");
  if (!next) return;
  next.status = "offered";
  next.offeredUntil = new Date(now.getTime() + OFFER_TTL_MS).toISOString();
  next.updatedAt = now.toISOString();
}

/** Lazy offer expiry: a due offer flips to expired and the seat passes to the next waiting entry. */
function refreshMockWaitlist(eventId: string, now: Date = new Date()): void {
  for (const entry of mockWaitlist) {
    if (entry.eventId !== eventId || entry.status !== "offered" || entry.offeredUntil === null) continue;
    if (new Date(entry.offeredUntil).getTime() > now.getTime()) continue;
    entry.status = "expired";
    entry.offeredUntil = null;
    entry.updatedAt = now.toISOString();
    offerNextMockWaitlist(eventId, now);
  }
}

/** Joins the queue of a sold-out event; "no_event"/"seats_available"/"duplicate"/"booked" map to 404/409 in the interceptor. */
function joinMockWaitlist(eventId: string, userId: string): WaitlistEntry | "no_event" | "seats_available" | "duplicate" | "booked" {
  if (!mockEvents.some((item) => item.id === eventId)) return "no_event";
  if ((remainingSeats(eventId) ?? 1) > 0) return "seats_available";
  if (mockBookings.some((booking) => booking.eventId === eventId && booking.userId === userId && booking.status === "active")) return "booked";
  if (waitlistQueue(eventId).some((entry) => entry.userId === userId)) return "duplicate";
  const now = new Date().toISOString();
  mockWaitlistSeq += 1;
  const entry: WaitlistEntry = { id: `82000000-0000-4000-8000-${String(mockWaitlistSeq).padStart(12, "0")}`, userId, eventId, position: 0, status: "waiting", offeredUntil: null, createdAt: now, updatedAt: now };
  mockWaitlist.push(entry);
  return withWaitlistPosition(entry);
}

/** Active (waiting|offered) entry of a user for an event with its FIFO position, or null (mock GET /waitlist/me). */
function myMockWaitlistEntry(eventId: string, userId: string): WaitlistEntry | null {
  refreshMockWaitlist(eventId);
  const entry = waitlistQueue(eventId).find((item) => item.userId === userId);
  return entry === undefined ? null : withWaitlistPosition(entry);
}

/** Confirms an offer into a booking on the reserved seat (no capacity re-check); null/"not_offered"/"offer_expired" map to 404/409 in the interceptor. */
function confirmMockWaitlistOffer(entryId: string): WaitlistEntry | null | "not_offered" | "offer_expired" {
  const entry = mockWaitlist.find((item) => item.id === entryId);
  if (!entry) return null;
  refreshMockWaitlist(entry.eventId);
  if (entry.status === "confirmed") return withWaitlistPosition(entry);
  if (entry.status === "expired") return "offer_expired";
  if (entry.status !== "offered" || entry.offeredUntil === null) return "not_offered";
  const position = withWaitlistPosition(entry).position;
  const now = new Date().toISOString();
  mockBookingSeq += 1;
  const booking: Booking = { id: `e0000000-0000-4000-8000-${String(mockBookingSeq).padStart(12, "0")}`, userId: entry.userId, eventId: entry.eventId, status: "active", createdAt: now, updatedAt: now };
  mockBookings.push(booking);
  ensureMockPayment(booking, now);
  entry.status = "confirmed";
  entry.offeredUntil = null;
  entry.updatedAt = now;
  return { ...entry, position };
}

/** Cancels a queue entry; a declined offer passes the reserved seat to the next waiting entry. Idempotent for cancelled entries; "already_confirmed"/"offer_expired" map to 409, null to 404 (mock 404). */
function declineMockWaitlistOffer(entryId: string): WaitlistEntry | null | "already_confirmed" | "offer_expired" {
  const entry = mockWaitlist.find((item) => item.id === entryId);
  if (!entry) return null;
  refreshMockWaitlist(entry.eventId);
  if (entry.status === "cancelled") return withWaitlistPosition(entry);
  if (entry.status === "confirmed") return "already_confirmed";
  if (entry.status === "expired") return "offer_expired";
  const wasOffered = entry.status === "offered";
  const now = new Date();
  entry.status = "cancelled";
  entry.offeredUntil = null;
  entry.updatedAt = now.toISOString();
  if (wasOffered) offerNextMockWaitlist(entry.eventId, now);
  return withWaitlistPosition(entry);
}

const mockCheckIns: CheckIn[] = [];
let mockCheckInSeq = 0;

export function resetMockCheckIns(): void {
  mockCheckIns.length = 0;
  mockCheckInSeq = 0;
}

/** Check-in of a user for an event, or null (mock state for the event page button). */
function checkInFor(userId: string, eventId: string): CheckIn | null {
  return mockCheckIns.find((item) => item.userId === userId && item.eventId === eventId) ?? null;
}

/** Creates an in-memory check-in for exactly one known event or place, idempotent per target; "no_target"/"invalid" map to 404/400 in the interceptor. */
export function createMockCheckIn(userId: string, payload: { eventId?: string; placeId?: string }): CheckIn | "no_target" | "invalid" {
  if (userId === "" || (payload.eventId === undefined) === (payload.placeId === undefined)) return "invalid";
  const known = payload.eventId !== undefined ? mockEvents.some((item) => item.id === payload.eventId) : mockPlaces.some((item) => item.id === payload.placeId);
  if (!known) return "no_target";
  const existing = mockCheckIns.find((item) => item.userId === userId && item.eventId === (payload.eventId ?? null) && item.placeId === (payload.placeId ?? null));
  if (existing) return existing;
  mockCheckInSeq += 1;
  const checkIn: CheckIn = { id: `60000000-0000-4000-8000-${String(mockCheckInSeq).padStart(12, "0")}`, userId, eventId: payload.eventId ?? null, placeId: payload.placeId ?? null, checkedInAt: new Date().toISOString() };
  mockCheckIns.push(checkIn);
  return checkIn;
}

/** Backend districtKey parity: a neighbourhood is a 0.01° geo cell of a visited place. */
function mockDistrictKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
}

/** Visit statistics derived from the check-ins of a user: events, unique places, their districts, per-category counters. */
function visitStatsFor(userId: string): VisitStats {
  const mine = mockCheckIns.filter((item) => item.userId === userId);
  const placeIds = new Set<string>();
  const byCategory = new Map<string, number>();
  for (const item of mine) {
    const event = item.eventId === null ? undefined : mockEvents.find((candidate) => candidate.id === item.eventId);
    if (item.placeId !== null) placeIds.add(item.placeId);
    if (event !== undefined) {
      if (event.placeId !== null) placeIds.add(event.placeId);
      byCategory.set(event.category, (byCategory.get(event.category) ?? 0) + 1);
    }
  }
  const districts = new Set(
    [...placeIds].flatMap((id) => {
      const place = mockPlaces.find((candidate) => candidate.id === id);
      return place ? [mockDistrictKey(place.latitude, place.longitude)] : [];
    }),
  );
  return {
    userId,
    placesCount: placeIds.size,
    eventsCount: mine.filter((item) => item.eventId !== null).length,
    districtsCount: districts.size,
    byCategory: EventCategorySchema.options.map((category) => ({ category, count: byCategory.get(category) ?? 0 })),
  };
}

/** The four README achievements («Исследователь города», «Музыкальный фанат», «Город за выходные», «Волонтер») with progress from visit stats. */
export function achievementsFor(stats: VisitStats): Achievement[] {
  const count = (category: string) => stats.byCategory.find((item) => item.category === category)?.count ?? 0;
  return [
    { code: "city_explorer", title: "Исследователь города", threshold: 10, progress: Math.min(stats.placesCount, 10), grantedAt: stats.placesCount >= 10 ? PLACE_STAMP : null },
    { code: "music_fan", title: "Музыкальный фанат", threshold: 5, progress: Math.min(count("afisha"), 5), grantedAt: count("afisha") >= 5 ? PLACE_STAMP : null },
    { code: "weekend_city", title: "Город за выходные", threshold: 3, progress: Math.min(stats.districtsCount, 3), grantedAt: stats.districtsCount >= 3 ? PLACE_STAMP : null },
    { code: "volunteer", title: "Волонтёр", threshold: 5, progress: Math.min(count("volunteering"), 5), grantedAt: count("volunteering") >= 5 ? PLACE_STAMP : null },
  ];
}

/** My-city summary and memory points derived from the check-ins of a user. */
export function myCityFor(userId: string): { summary: MyCitySummary; points: MemoryPoint[] } {
  const stats = visitStatsFor(userId);
  const summary: MyCitySummary = { userId, placesCount: stats.placesCount, eventsCount: stats.eventsCount, districtsCount: stats.districtsCount };
  const points = mockCheckIns
    .filter((item) => item.userId === userId && item.eventId !== null)
    .flatMap((item) => {
      const event = mockEvents.find((candidate) => candidate.id === item.eventId)!;
      const lat = event.placeId === null ? null : (mockPlaces.find((candidate) => candidate.id === event.placeId)?.latitude ?? null);
      const lng = event.placeId === null ? null : (mockPlaces.find((candidate) => candidate.id === event.placeId)?.longitude ?? null);
      return lat === null || lng === null ? [] : [{ latitude: lat, longitude: lng, eventId: item.eventId, placeId: null, visitedAt: item.checkedInAt }];
    });
  return { summary, points };
}

/** Active bookings of a user, enriched with their event and place. */
export function calendarEntries(userId: string): { booking: Booking; event: Event; place: Place | null }[] {
  const entries: { booking: Booking; event: Event; place: Place | null }[] = [];
  for (const booking of mockBookings) {
    if (booking.userId !== userId || booking.status !== "active") continue;
    const event = mockEvents.find((item) => item.id === booking.eventId);
    if (!event) continue;
    entries.push({ booking, event, place: mockPlaces.find((item) => item.id === event.placeId) ?? null });
  }
  return entries;
}

/** "What to do today?" digest: curated cards from fixtures; the showcase friends (Анна → выставка, Катя → фестиваль) back the friends counter. */
export function todayPicks(): TodayResponse {
  const cards: TodayEventCard[] = [
    {
      event: mockEvents[1],
      labels: [
        { kind: "distance", minutes: 15 },
        { kind: "friend_attending", friendName: "Анна" },
      ],
    },
    {
      event: mockEvents[11],
      labels: [
        { kind: "distance", minutes: 20 },
        { kind: "friend_attending", friendName: "Катя" },
      ],
    },
    { event: mockEvents[9], labels: [{ kind: "free_entry" }, { kind: "spots_left", count: remainingSeats(mockEvents[9].id) ?? 0 }] },
  ];
  return {
    summary: {
      nearbyCount: mockEvents.length,
      suitableCount: cards.length,
      withFriendsCount: cards.filter((card) => card.labels.some((label) => label.kind === "friend_attending")).length,
    },
    cards,
  };
}

/** The fixed demo "now" for the nearby surface: noon of MOCK_TODAY, so the four buckets fill deterministically (12:30 -> now, 15:00 -> inAnHour, 19:00 -> evening, next morning -> tomorrow). */
export const MOCK_NOW = new Date(`${MOCK_TODAY}T12:00:00+03:00`);

const HOUR_MS = 60 * 60 * 1000;
const NEARBY_MAX_KM = 15;

/** Rough great-circle distance, backend haversine parity. */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

function moscowHour(date: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Moscow", hour: "2-digit", hour12: false }).format(date));
}

/** Exclusive bucket of an event start relative to the demo now (mirrors the backend nearbyBucket). */
function mockNearbyBucket(startsAt: string, now: Date = MOCK_NOW): NearbyBucket | null {
  const start = new Date(startsAt);
  const delta = start.getTime() - now.getTime();
  if (delta < 0) return null;
  if (delta < HOUR_MS) return "now";
  if (moscowDateKey(startsAt) === moscowDateKey(now.toISOString())) return moscowHour(start) >= 18 ? "evening" : "inAnHour";
  if (moscowDateKey(startsAt) === moscowDateKey(new Date(now.getTime() + 24 * HOUR_MS).toISOString())) return "tomorrow";
  return null;
}

/** Four-bucket nearby timeline from fixtures within 48h of the demo now and 15 km of the requested coords, promoted first then by distance (backend parity). */
export function nearbyTimeline(latitude: number, longitude: number, now: Date = MOCK_NOW): NearbyTimeline {
  const timeline: NearbyTimeline = { now: [], inAnHour: [], evening: [], tomorrow: [] };
  const cards: NearbyCard[] = [];
  const horizon = now.getTime() + 48 * HOUR_MS;
  for (const item of mockEvents) {
    if (item.placeId === null) continue;
    const place = mockPlaces.find((candidate) => candidate.id === item.placeId);
    if (!place) continue;
    const start = new Date(item.startsAt).getTime();
    if (start < now.getTime() || start > horizon) continue;
    const bucket = mockNearbyBucket(item.startsAt, now);
    if (bucket === null) continue;
    const km = haversineKm(latitude, longitude, place.latitude, place.longitude);
    if (km > NEARBY_MAX_KM) continue;
    cards.push({ event: item, place, distanceKm: Math.round(km * 10) / 10, bucket, promoted: item.promoted });
  }
  cards.sort((a, b) => Number(b.promoted) - Number(a.promoted) || a.distanceKm - b.distanceKm || a.event.startsAt.localeCompare(b.event.startsAt));
  for (const card of cards) timeline[card.bucket].push(card);
  return timeline;
}

/** Deterministic per-mood leisure chains from fixtures inside the free window; the title is the chain joined by arrows (README «Парк → выставка → бар» style). */
export function leisureOptions(hours: number, mood: LeisureMood, latitude: number, longitude: number, now: Date = MOCK_NOW): LeisureOption[] {
  const until = now.getTime() + hours * HOUR_MS;
  const events = mockEvents
    .filter((item) => {
      const start = new Date(item.startsAt).getTime();
      return start >= now.getTime() && start <= until;
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const places = mockPlaces
    .map((place) => ({ place, km: haversineKm(latitude, longitude, place.latitude, place.longitude) }))
    .filter((row) => row.km <= NEARBY_MAX_KM)
    .sort((a, b) => a.km - b.km);
  const placeStop = (place: Place): LeisureStop => ({ kind: "place", placeId: place.id, eventId: null, title: place.title, startsAt: null });
  const eventStop = (item: Event): LeisureStop => ({ kind: "event", placeId: item.placeId, eventId: item.id, title: item.title, startsAt: item.startsAt });
  let stops: LeisureStop[] = [];
  if (mood === "relax") {
    const park = places.find((row) => row.place.category === "park");
    const show = events.find((item) => item.category === "afisha");
    const museum = places.find((row) => row.place.category === "museum");
    const food = places.find((row) => row.place.category === "food");
    if (park) stops.push(placeStop(park.place));
    if (show) stops.push(eventStop(show));
    else if (museum) stops.push(placeStop(museum.place));
    if (food) stops.push(placeStop(food.place));
  } else if (mood === "active") {
    const sport = events.find((item) => item.category === "sport");
    const sportPlace = places.find((row) => row.place.category === "sport");
    const park = places.find((row) => row.place.category === "park");
    if (sport) stops.push(eventStop(sport));
    else if (sportPlace) stops.push(placeStop(sportPlace.place));
    if (park) stops.push(placeStop(park.place));
  } else {
    // ponytail: the mock has no friend-participation feed for the demo window — friends chain = the window events, soonest first
    stops = events.slice(0, 3).map(eventStop);
  }
  if (stops.length === 0) return [];
  return [{ mood, title: stops.map((stop) => stop.title).join(" → "), stops }];
}

/** Coordinate query params mirroring the backend validation (missing/out-of-range -> null -> 400 in the interceptor). */
function parseMockCoords(url: URL): [number, number] | null {
  const latitude = url.searchParams.get("latitude");
  const longitude = url.searchParams.get("longitude");
  if (latitude === null || longitude === null) return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) return null;
  return [lat, lng];
}

/** Place friend-visit seeds: [friend index, mockEvents index] — "Анна была здесь 3 раза"-style fixtures for the park. */
const MOCK_PLACE_VISIT_SEED: [number, number][] = [
  [0, 12],
  [0, 9],
  [0, 10],
  [1, 2],
];

/** Place social page aggregate (mock): today events (MOCK_TODAY Moscow day), friend visits, place rating from the reviews of its events, popularity today, personal visits; null for an unknown place. */
export function placePageFor(placeId: string, userId: string, day = MOCK_TODAY): PlacePage | null {
  const place = mockPlaces.find((item) => item.id === placeId);
  if (!place) return null;
  const atPlace = mockEvents.filter((item) => item.placeId === placeId);
  const todayEvents = atPlace.filter((item) => moscowDateKey(item.startsAt) === day);
  const todayEventIds = new Set(todayEvents.map((item) => item.id));
  const eventIds = new Set(atPlace.map((item) => item.id));
  const scoped = mockCheckIns.filter((item) => (item.placeId !== null && item.placeId === placeId) || (item.eventId !== null && eventIds.has(item.eventId)));
  const popularityToday = scoped.filter((item) => item.placeId === placeId).length;
  const personalVisitsCount = scoped.filter((item) => item.userId === userId).length;
  const visitsByFriend = new Map<string, number>();
  for (const [friend, eventItem] of MOCK_PLACE_VISIT_SEED) {
    if (mockEvents[eventItem].placeId !== placeId) continue;
    const friendId = mockFriendIds[friend];
    visitsByFriend.set(friendId, (visitsByFriend.get(friendId) ?? 0) + 1);
  }
  const goingToday = new Set<string>();
  for (const record of mockParticipations.values()) {
    if (!todayEventIds.has(record.eventId) || !mockFriendIds.includes(record.userId)) continue;
    if (record.status === "going" || record.status === "wants_to_go") goingToday.add(record.userId);
  }
  const friendIds = new Set([...visitsByFriend.keys(), ...goingToday]);
  const friends: PlacePage["friends"] = [...friendIds].map((friendId) => mockFriends.find((friend) => friend.id === friendId)).flatMap((friend) => (friend === undefined ? [] : [{ friend, visitsCount: visitsByFriend.get(friend.id) ?? 0, goingToday: goingToday.has(friend.id) }]));
  const reviews = mockReviews.filter((item) => item.eventId !== null && eventIds.has(item.eventId));
  const rating =
    reviews.length === 0
      ? null
      : {
          summary: { eventId: null, placeId, averageStars: reviews.reduce((sum, item) => sum + item.stars, 0) / reviews.length, reviewsCount: reviews.length },
          categoryAverages: { atmosphere: null, organization: null, price: null, place: null } as EventRating["categoryAverages"],
        };
  const categoryKeys = ["atmosphere", "organization", "price", "place"] as const;
  if (rating !== null) {
    for (const key of categoryKeys) {
      const scores = reviews.flatMap((item) => (item.categoryScores[key] === undefined ? [] : [item.categoryScores[key]!]));
      rating.categoryAverages[key] = scores.length === 0 ? null : scores.reduce((sum, score) => sum + score, 0) / scores.length;
    }
  }
  return { placeId, todayEvents, friends, rating, popularityToday, personalVisitsCount };
}

const mockProfiles = new Map<string, Profile>();

/** Friend profile seeds for the discovery/people mocks: matching interests plus Лена hiding her routes (privacy gates parity). */
const MOCK_FRIEND_PROFILE_SEED: { interests: string[]; routesHidden: boolean }[] = [
  { interests: ["музыка", "выставки"], routesHidden: false },
  { interests: ["спорт"], routesHidden: false },
  { interests: ["кино", "музыка"], routesHidden: false },
  { interests: ["гастрономия"], routesHidden: false },
  { interests: ["музыка", "кино"], routesHidden: false },
  { interests: ["гастрономия", "спорт"], routesHidden: false },
  { interests: ["йога"], routesHidden: true },
];

function seedMockProfiles(): void {
  mockProfiles.clear();
  mockFriends.forEach((friend, index) => {
    const seed = MOCK_FRIEND_PROFILE_SEED[index];
    mockProfiles.set(friend.id, { userId: friend.id, city: "Москва", interests: [...seed.interests], smartAlerts: { ...DEFAULT_SMART_ALERTS }, privacy: seed.routesHidden ? { visitHistory: "friends", routes: "hidden" } : { ...DEFAULT_PRIVACY }, recommendationsEnabled: true });
  });
}
seedMockProfiles();

export function resetMockProfiles(): void {
  seedMockProfiles();
}

function profileFor(userId: string): Profile {
  return mockProfiles.get(userId) ?? { userId, city: "Москва", interests: [], smartAlerts: { ...DEFAULT_SMART_ALERTS }, privacy: { ...DEFAULT_PRIVACY }, recommendationsEnabled: true };
}

/** Reverse-discovery friend visit seeds: [mockFriends index, mockPlaces index] in chronological visit order per friend. */
const MOCK_DISCOVERY_VISIT_SEED: [number, number][] = [
  [0, 1],
  [0, 3],
  [0, 4],
  [1, 2],
  [1, 3],
  [2, 1],
  [5, 3],
  [6, 0],
];

/** Places the demo user has already visited, from the mock check-ins (event check-ins resolve to their place, backend parity). */
function myVisitedPlaceIds(): Set<string> {
  const ids = new Set<string>();
  for (const item of mockCheckIns) {
    if (item.userId !== mockDemoUser.id) continue;
    if (item.placeId !== null) ids.add(item.placeId);
    else if (item.eventId !== null) {
      const eventPlace = mockEvents.find((candidate) => candidate.id === item.eventId)?.placeId;
      if (eventPlace) ids.add(eventPlace);
    }
  }
  return ids;
}

/** Places of one friend the demo user has not visited, deduplicated in visit order (backend unseenPlaces parity). */
function unseenFriendPlaces(friendIndex: number, myPlaceIds: Set<string>): Place[] {
  const seen = new Set<string>();
  const unseen: Place[] = [];
  for (const [friend, placeIndex] of MOCK_DISCOVERY_VISIT_SEED) {
    if (friend !== friendIndex) continue;
    const place = mockPlaces[placeIndex];
    if (myPlaceIds.has(place.id) || seen.has(place.id)) continue;
    seen.add(place.id);
    unseen.push(place);
  }
  return unseen;
}

/** Reverse discovery summary (mock GET /discovery): per-friend unseen places minus the demo user's check-ins, privacy-gated (backend DiscoveryService.summary parity). */
export function discoverySummary(): DiscoveryResponse {
  const myPlaceIds = myVisitedPlaceIds();
  const unique = new Set<string>();
  const byFriend: DiscoveryFriendPlaces[] = [];
  for (const [index, friend] of mockFriends.entries()) {
    const privacy = profileFor(friend.id).privacy;
    if (privacy.visitHistory === "hidden") continue;
    const unseen = unseenFriendPlaces(index, myPlaceIds);
    for (const place of unseen) unique.add(place.id);
    if (unseen.length === 0) continue;
    byFriend.push({ friend, newPlacesCount: unseen.length, places: privacy.routes === "hidden" ? [] : unseen });
  }
  byFriend.sort((a, b) => b.newPlacesCount - a.newPlacesCount || a.friend.name.localeCompare(b.friend.name));
  return { newPlacesCount: unique.size, byFriend };
}

/** Friend route of unseen places (mock GET /discovery/friends/:userId/route); "own"/"not_friend"/"hidden" map to 403/404/403 in the interceptor (backend DiscoveryService.route parity). */
export function friendRoute(userId: string): FriendRoute | "own" | "not_friend" | "hidden" {
  if (userId === mockDemoUser.id) return "own";
  const index = mockFriendIds.indexOf(userId);
  if (index === -1) return "not_friend";
  const privacy = profileFor(userId).privacy;
  if (privacy.routes === "hidden" || privacy.visitHistory === "hidden") return "hidden";
  return { friend: mockFriends[index], places: unseenFriendPlaces(index, myVisitedPlaceIds()) };
}

const PEOPLE_MAX_KM = 15;
const PEOPLE_GOING: ParticipationStatus[] = ["wants_to_go", "probably_going", "going", "looking_for_company", "looking_for_travel_buddy", "looking_for_after_event_company"];

/** Demo viewer interests backing the people matching (the editable demo profile starts empty; the backend reads the viewer profile). */
const MOCK_DEMO_INTERESTS = ["музыка", "кино", "гастрономия"];

/** Friends looking for company today; the backend derives this from COMPANY participations on today events — seeded to keep the friends-feed fixtures stable. */
const MOCK_LOOKING_TODAY = new Set<string>([mockFriendIds[3], mockFriendIds[4]]);

/** Latest seeded visit place of a friend (geo origin of the people distance, backend latest-check-in parity). */
function latestVisitPlace(friendIndex: number): Place | null {
  for (let index = MOCK_DISCOVERY_VISIT_SEED.length - 1; index >= 0; index -= 1) {
    const [friend, placeIndex] = MOCK_DISCOVERY_VISIT_SEED[index];
    if (friend === friendIndex) return mockPlaces[placeIndex];
  }
  return null;
}

/** People matching (mock GET /people): mockFriends sharing a seeded demo interest or a going-status participation on the same upcoming event; distance from the requested coords to the friend's latest visit within 15 km, friends without visits stay via the shared city (backend PeopleService parity). */
export function peopleSuggest(latitude: number, longitude: number, now: Date = MOCK_NOW): PeopleResponse {
  const myInterests = new Set(MOCK_DEMO_INTERESTS.map((interest) => interest.toLowerCase()));
  const upcoming = new Set(mockEvents.filter((item) => new Date(item.startsAt).getTime() >= now.getTime()).map((item) => item.id));
  const myEventIds = new Set([...mockParticipations.values()].filter((row) => row.userId === mockDemoUser.id && PEOPLE_GOING.includes(row.status)).map((row) => row.eventId));
  const people: PeopleCandidate[] = [];
  for (const [index, friend] of mockFriends.entries()) {
    const profile = profileFor(friend.id);
    const sharedInterests = profile.interests.filter((interest) => myInterests.has(interest.toLowerCase()));
    const sharedEvent = [...mockParticipations.values()].find((row) => row.userId === friend.id && PEOPLE_GOING.includes(row.status) && myEventIds.has(row.eventId) && upcoming.has(row.eventId));
    let distanceKm: number | null = null;
    const visit = profile.privacy.visitHistory === "hidden" ? null : latestVisitPlace(index);
    if (visit !== null) {
      distanceKm = Math.round(haversineKm(latitude, longitude, visit.latitude, visit.longitude) * 10) / 10;
      if (distanceKm > PEOPLE_MAX_KM) continue;
    }
    if (sharedInterests.length === 0 && sharedEvent === undefined) continue;
    const event = sharedEvent === undefined ? null : mockEvents.find((item) => item.id === sharedEvent.eventId)!;
    const context: PeopleMatchContext = event === null ? { kind: "shared_interest", interest: sharedInterests[0], explanation: `общий интерес: ${sharedInterests[0]}` } : { kind: "shared_event", event, explanation: `вы оба хотите на «${event.title}»` };
    people.push({ person: friend, distanceKm, sharedInterests, lookingForCompanyToday: MOCK_LOOKING_TODAY.has(friend.id), context });
  }
  people.sort((a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99) || a.person.name.localeCompare(b.person.name));
  return { nearbyCount: people.length, lookingForCompanyTodayCount: people.filter((row) => row.lookingForCompanyToday).length, people };
}

/** Viewer coords when the people query carries no lat/lng (MOSCOW_CENTER parity with the nearby screen ponytail). */
const MOCK_PEOPLE_CENTER: [number, number] = [55.7522, 37.6156];

/** lat/lng query params mirroring the backend parseOrigin: both absent -> null (caller default); partial or out-of-range -> "invalid" (400). */
function parseMockOrigin(url: URL): [number, number] | null | "invalid" {
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");
  if ((lat === null || lat === "") && (lng === null || lng === "")) return null;
  if (lat === null || lat === "" || lng === null || lng === "") return "invalid";
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return "invalid";
  return [latitude, longitude];
}

function remainingSeats(eventId: string): number | null {
  const target = mockEvents.find((item) => item.id === eventId);
  if (!target || target.capacity === null) return null;
  refreshMockWaitlist(eventId);
  const taken = mockBookings.filter((booking) => booking.eventId === eventId && booking.status === "active").length + mockWaitlist.filter((entry) => entry.eventId === eventId && entry.status === "offered").length;
  return target.capacity - taken;
}

function eventDetails(eventId: string, userId: string): object | null {
  const event = mockEvents.find((item) => item.id === eventId);
  if (!event) return null;
  const active = mockBookings.find((booking) => booking.eventId === eventId && booking.userId === userId && booking.status === "active");
  return {
    event: eventPromoted(event),
    place: mockPlaces.find((item) => item.id === event.placeId) ?? null,
    organizer: mockOrganizers[0],
    organization: mockOrganization,
    remainingSeats: remainingSeats(eventId),
    activeBookingId: active?.id ?? null,
    checkInId: checkInFor(userId, eventId)?.id ?? null,
  };
}

function parseBookingBody(init?: RequestInit): Record<string, unknown> | undefined {
  try {
    return JSON.parse(typeof init?.body === "string" ? init.body : "null");
  } catch {
    return undefined;
  }
}

// Backend plans.service parity: walking pace, food radius and the dinner->road->meetup->event buffers.
const WALK_M_PER_MIN = 80;
const FOOD_RADIUS_KM = 2;
const MEETUP_BUFFER_MIN = 20;
const DINNER_MIN = 70;

function walkingMinutes(meters: number): number {
  return Math.max(0, Math.round(meters / WALK_M_PER_MIN));
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return Math.round(haversineKm(lat1, lon1, lat2, lon2) * 1000);
}

/** Autoplan after «Пойду» (mock POST /plans/auto, backend generateAutoplan parity): walk estimate to the venue, up to 3 nearest food places within 2 km, the dinner->road->meetup->event timeline and a persisted draft plan card; "no_event" maps to 404 in the interceptor. */
export function createMockAutoPlan(payload: CreateAutoPlanWrite): AutoPlanProposal | "no_event" {
  const event = mockEvents.find((item) => item.id === payload.eventId);
  if (!event) return "no_event";
  const venue = event.placeId === null ? null : (mockPlaces.find((item) => item.id === event.placeId) ?? null);
  const meters = venue === null ? 0 : haversineMeters(payload.latitude, payload.longitude, venue.latitude, venue.longitude);
  const travelMinutes = walkingMinutes(meters);
  const foodPlaces =
    venue === null
      ? []
      : mockPlaces
          .filter((item) => item.category === "food")
          .map((item) => ({ item, km: haversineKm(venue.latitude, venue.longitude, item.latitude, item.longitude) }))
          .filter((row) => row.km <= FOOD_RADIUS_KM)
          .sort((a, b) => a.km - b.km)
          .slice(0, 3)
          .map((row) => row.item);
  const startsAt = new Date(event.startsAt);
  const meetupAt = new Date(startsAt.getTime() - (travelMinutes + MEETUP_BUFFER_MIN) * 60_000);
  const dinnerAt = new Date(meetupAt.getTime() - DINNER_MIN * 60_000);
  const meetingPoint = foodPlaces[0]?.title ?? venue?.address ?? event.city;
  const now = new Date().toISOString();
  mockPlanSeq += 1;
  const card: PlanCard = {
    plan: { id: `90000000-0000-4000-8000-${String(mockPlanSeq).padStart(12, "0")}`, eventId: event.id, participants: [], meetingPoint, meetingAt: meetupAt.toISOString(), chatLink: null, createdAt: now, updatedAt: now },
    event,
    distanceMeters: meters,
  };
  mockPlans.push(card);
  const timeline: AutoPlanTimelineEntry[] = [];
  if (foodPlaces[0]) timeline.push({ at: dinnerAt.toISOString(), label: "ужин", detail: foodPlaces[0].title });
  timeline.push({ at: meetupAt.toISOString(), label: "дорога", detail: `${travelMinutes} мин до места` });
  timeline.push({ at: meetupAt.toISOString(), label: "встреча", detail: meetingPoint });
  timeline.push({ at: startsAt.toISOString(), label: "событие", detail: event.title });
  return { plan: card, travelMinutes, foodPlaces, timeline };
}

type MockRouteError = "no_event" | "no_place" | "event_without_place";

/** Resolve event/place stops to route points from fixtures (backend RoutesService.resolve parity); the optional origin becomes the «Старт» point. */
function mockRoutePoints(payload: CreateDayRouteWrite): RoutePoint[] | MockRouteError {
  const points: RoutePoint[] = [];
  for (const stop of payload.stops) {
    if (stop.eventId != null) {
      const event = mockEvents.find((item) => item.id === stop.eventId);
      if (!event) return "no_event";
      if (event.placeId === null) return "event_without_place";
      const place = mockPlaces.find((item) => item.id === event.placeId);
      if (!place) return "no_place";
      points.push({ title: event.title, at: new Date(event.startsAt).toISOString(), latitude: place.latitude, longitude: place.longitude, eventId: event.id, placeId: place.id });
    } else {
      const place = mockPlaces.find((item) => item.id === stop.placeId);
      if (!place) return "no_place";
      points.push({ title: place.title, at: null, latitude: place.latitude, longitude: place.longitude, eventId: null, placeId: place.id });
    }
  }
  if (payload.latitude !== undefined && payload.longitude !== undefined) {
    points.unshift({ title: "Старт", at: null, latitude: payload.latitude, longitude: payload.longitude, eventId: null, placeId: null });
  }
  return points;
}

/** Ordered points -> walking legs and totals (backend toDayRoute parity). */
function mockDayRoute(points: RoutePoint[]): DayRoute {
  const legs: RouteLeg[] = [];
  let totalMeters = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    const meters = haversineMeters(from.latitude, from.longitude, to.latitude, to.longitude);
    totalMeters += meters;
    legs.push({ fromTitle: from.title, toTitle: to.title, travelMinutes: walkingMinutes(meters), distanceKm: Math.round((meters / 1000) * 10) / 10 });
  }
  return { points, legs, totalMinutes: walkingMinutes(totalMeters), totalKm: Math.round((totalMeters / 1000) * 10) / 10 };
}

function mockRouteMeters(points: RoutePoint[]): number {
  let sum = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    sum += haversineMeters(points[index].latitude, points[index].longitude, points[index + 1].latitude, points[index + 1].longitude);
  }
  return sum;
}

function mockPermutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  const result: T[][] = [];
  items.forEach((item, index) => {
    const rest = items.filter((_, i) => i !== index);
    for (const perm of mockPermutations(rest)) result.push([item, ...perm]);
  });
  return result;
}

/** Day route from 2..8 stops (mock POST /routes); error tags map to 404/400 in the interceptor. */
export function buildMockDayRoute(payload: CreateDayRouteWrite): DayRoute | MockRouteError {
  const points = mockRoutePoints(payload);
  return typeof points === "string" ? points : mockDayRoute(points);
}

/** Optimized day route: brute-force permutation of the stops after the first (mock POST /routes/optimize, ≤8 stops per contract, so ≤5040 candidates). */
export function optimizeMockDayRoute(payload: CreateDayRouteWrite): OptimizeRoute | MockRouteError {
  const points = mockRoutePoints(payload);
  if (typeof points === "string") return points;
  const original = mockDayRoute(points);
  const [head, ...tail] = points;
  let best = points;
  let bestMeters = mockRouteMeters(points);
  for (const perm of mockPermutations(tail)) {
    const candidate = [head, ...perm];
    const meters = mockRouteMeters(candidate);
    if (meters < bestMeters) {
      best = candidate;
      bestMeters = meters;
    }
  }
  const optimized = mockDayRoute(best);
  return { original, optimized, savedMinutes: original.totalMinutes - optimized.totalMinutes, savedKm: Math.round((original.totalKm - optimized.totalKm) * 10) / 10 };
}

/** Backend AssistRateLimiter parity: 20 hits per 10 minutes per user (the mock serves the single demo user). */
export const MOCK_ASSIST_RATE_LIMIT = 20;
const MOCK_ASSIST_RATE_WINDOW_MS = 10 * 60 * 1000;
const mockAssistHits: number[] = [];

/** Clear the in-memory assist rate-limit window (test isolation). */
export function resetMockAssist(): void {
  mockAssistHits.length = 0;
}

function mockAssistRateHit(now: number = Date.now()): boolean {
  const cutoff = now - MOCK_ASSIST_RATE_WINDOW_MS;
  while (mockAssistHits.length > 0 && mockAssistHits[0] <= cutoff) mockAssistHits.shift();
  if (mockAssistHits.length >= MOCK_ASSIST_RATE_LIMIT) return false;
  mockAssistHits.push(now);
  return true;
}

/** Backend sanitizeAssistQuery parity: strip injection wrappers; empty after sanitize is invalid. */
function mockSanitizeAssistQuery(raw: string): string {
  return raw
    .replace(/ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi, " ")
    .replace(/system\s*:/gi, " ")
    .replace(/<\|[\s\S]*?\|>/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^[.\s,:;-]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Backend parseAssistQuery parity: deterministic NL heuristics (числа→budget, «вечером»→evening, «с девушкой»→partner, «музыка»→music). */
export function mockParseAssistQuery(query: string): AssistCriteria {
  const text = query.toLowerCase();
  const when: AssistCriteria["when"] = text.includes("вечер") ? "evening" : text.includes("утр") ? "morning" : text.includes("днём") || text.includes("днем") || text.includes("обед") ? "afternoon" : "any";
  const budgetMatch = /(\d[\d\s]*)\s*(₽|руб)/i.exec(text);
  const budget = budgetMatch ? Number(budgetMatch[1].replace(/\s/g, "")) : NaN;
  const company: AssistCriteria["company"] = text.includes("девушк") || text.includes("парн") || text.includes("двоем") || text.includes("вдвоём") ? "partner" : text.includes("дет") ? "kids" : text.includes("друз") || text.includes("компани") ? "friends" : "alone";
  const genre: AssistCriteria["genre"] = text.includes("музык") || text.includes("джаз") || text.includes("концерт") ? "music" : text.includes("спорт") || text.includes("футбол") || text.includes("зал") ? "sport" : text.includes("парк") || text.includes("прогул") || text.includes("природ") ? "outdoors" : "any";
  return { when, budgetMaxRub: Number.isFinite(budget) ? budget : null, company, genre };
}

function mockMoscowHour(startsAt: string): number {
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Moscow", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date(startsAt)).find((part) => part.type === "hour")?.value;
  return Number(hour ?? "0");
}

/** Backend selectWheretoItems parity: mood -> categories, budget (!isPaid free / <=3000 under_3000), company soft filters, upcoming from MOCK_NOW, soonest first, max 5 (fixtures carry no published flag). */
export function wheretoSuggestions(query: WheretoQuery, now: Date = MOCK_NOW): WheretoResponse {
  const moodCategories: Record<WheretoMood, EventCategory[]> = { active: ["sport", "tourism"], calm: ["afisha"], unusual: ["volunteering", "tourism"] };
  return {
    items: mockEvents
      .filter((item) => new Date(item.startsAt).getTime() >= now.getTime())
      .filter((item) => moodCategories[query.mood].includes(item.category))
      .filter((item) => query.budget === "any" || !item.isPaid || (query.budget === "under_3000" && item.priceRub !== null && item.priceRub <= 3000))
      .filter((item) => query.company !== "partner" || item.category !== "volunteering")
      .filter((item) => query.company !== "kids" || (item.priceRub ?? 0) <= 3000)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id))
      .slice(0, 5),
  };
}

/** Backend matchAssistEvents parity: events from MOCK_NOW filtered by the parsed criteria, soonest first, max 7 (fixtures carry no published flag). */
function mockAssistMatches(criteria: AssistCriteria, now: Date = MOCK_NOW): Event[] {
  return mockEvents
    .filter((item) => new Date(item.startsAt).getTime() >= now.getTime())
    .filter((item) => {
      if (criteria.when === "any") return true;
      const hour = mockMoscowHour(item.startsAt);
      if (criteria.when === "morning") return hour < 12;
      if (criteria.when === "afternoon") return hour >= 12 && hour < 17;
      return hour >= 17;
    })
    .filter((item) => criteria.budgetMaxRub === null || !item.isPaid || (item.priceRub !== null && item.priceRub <= criteria.budgetMaxRub))
    .filter((item) => criteria.company !== "partner" || item.category !== "volunteering")
    .filter((item) => {
      if (criteria.genre === "any") return true;
      const blob = `${item.title} ${item.description}`.toLowerCase();
      if (criteria.genre === "music") return item.category === "afisha" || /музык|джаз|концерт|симфон|рахманин/.test(blob);
      if (criteria.genre === "sport") return item.category === "sport";
      return item.category === "tourism" || item.category === "volunteering";
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id))
    .slice(0, 7);
}

/** Backend explainPick parity. */
function mockAssistExplanation(fromHistory: boolean, fromPartner: boolean): string {
  if (fromHistory && fromPartner) return "По твоей истории, и уже сохранила твоя девушка";
  if (fromHistory) return "По твоей истории";
  if (fromPartner) return "Уже сохранила твоя девушка";
  return "Подходит по запросу";
}

/** Backend formatAssistSummary parity. */
function mockAssistSummary(total: number, history: number, saved: number): string {
  if (total === 0) return "Не нашел вариантов по запросу.";
  return `Нашел ${total} вариантов, ${history} по твоей истории, ${saved} уже сохранила твоя девушка`;
}

type MockAssistError = "rate_limited" | "invalid" | "no_events";

/** Backend AssistService.suggest parity: rate limit -> sanitize -> parse -> match -> explain from the demo check-ins and the first friend's saved items; error tags map to 429/400 in the interceptor. */
export function mockAssistSuggest(payload: AssistQueryWrite): AssistResponse | MockAssistError {
  if (!mockAssistRateHit()) return "rate_limited";
  const cleaned = mockSanitizeAssistQuery(payload.query);
  if (!cleaned) return "invalid";
  const criteria = mockParseAssistQuery(cleaned);
  const matched = mockAssistMatches(criteria);
  const historyIds = new Set(mockCheckIns.filter((item) => item.userId === mockDemoUser.id && item.eventId !== null).map((item) => item.eventId as string));
  const historyCategories = new Set(mockEvents.filter((item) => historyIds.has(item.id)).map((item) => item.category));
  const partnerListIds = new Set(listsFor(mockFriendIds[0]).map((list) => list.id));
  const savedIds = new Set(mockListItems.filter((item) => partnerListIds.has(item.listId) && item.eventId !== null).map((item) => item.eventId as string));
  const items: AssistPick[] = matched.map((matchedEvent) => ({ event: matchedEvent, explanation: mockAssistExplanation(historyIds.has(matchedEvent.id) || historyCategories.has(matchedEvent.category), savedIds.has(matchedEvent.id)) }));
  const historyCount = items.filter((row) => historyIds.has(row.event.id) || historyCategories.has(row.event.category)).length;
  const savedCount = items.filter((row) => savedIds.has(row.event.id)).length;
  return { summary: mockAssistSummary(items.length, historyCount, savedCount), criteria, items };
}

/** Backend nextSaturdayKey parity: next Saturday (today counts) as a Moscow YYYY-MM-DD key, from MOCK_NOW by default. */
export function mockAssistSaturdayKey(now: Date = MOCK_NOW): string {
  const label = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Moscow", weekday: "short" }).format(now);
  const weekday = { Sun: 7, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>;
  const addDays = (6 - (weekday[label] ?? 0) + 7) % 7;
  return moscowDateKey(new Date(now.getTime() + addDays * 86_400_000).toISOString());
}

/** Backend AssistService.planSaturday parity: up to 4 stops of the nearest Saturday, past hours excluded (startsAt >= now), + planDraft; with save=true the plan is persisted into the mock plans, plan is null otherwise; error tags map to 429/400 in the interceptor. */
export function mockAssistDay(payload: AssistQueryWrite, now: Date = MOCK_NOW): AssistDayResponse | MockAssistError {
  if (!mockAssistRateHit()) return "rate_limited";
  const cleaned = mockSanitizeAssistQuery(payload.query);
  if (!cleaned) return "invalid";
  const date = mockAssistSaturdayKey(now);
  const catalog = mockEvents
    .filter((item) => moscowDateKey(item.startsAt) === date && new Date(item.startsAt).getTime() >= now.getTime())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id))
    .slice(0, 4);
  if (catalog.length === 0) return "no_events";
  const stops = catalog.map((stopEvent) => ({ at: stopEvent.startsAt, event: stopEvent, explanation: "Слот субботнего дня" }));
  const first = catalog[0];
  const planDraft = { eventId: first.id, participantIds: [] as string[], meetingPoint: first.title, meetingAt: first.startsAt };
  let plan: PlanCard | null = null;
  if (payload.save === true) {
    const now = new Date().toISOString();
    mockPlanSeq += 1;
    plan = { plan: { id: `90000000-0000-4000-8000-${String(mockPlanSeq).padStart(12, "0")}`, eventId: planDraft.eventId, participants: [], meetingPoint: planDraft.meetingPoint, meetingAt: planDraft.meetingAt, chatLink: null, createdAt: now, updatedAt: now }, event: first, distanceMeters: 0 };
    mockPlans.push(plan);
  }
  return { summary: `Собрал день на субботу ${date}: ${stops.length} событий`, date, stops, planDraft, plan };
}

/** Organizer panel store item: the contract entity plus the published flag the backend keeps server-side (organizer DTOs omit it; the mock surfaces it so the client can badge drafts). */
type MockOrganizerEvent = Event & { published: boolean };
type MockOrganizerPlace = Place & { published: boolean };

/** Seeded published paid organizer event (#196/#206 demo + tests): two frozen ticket sales, one cancelled booking and seeded views are attached by seedMockOrganizerAddons. */
export const MOCK_ORGANIZER_PAID_EVENT_ID = "c00000f2-0000-4000-8000-0000000000f2";

function seedMockOrganizer(): { events: MockOrganizerEvent[]; places: MockOrganizerPlace[] } {
  return {
    events: [
      { ...event({ id: "c00000f1-0000-4000-8000-0000000000f1", title: "Акустический вечер в «Депо»", category: "afisha", city: "Москва", startsAt: "2026-10-11T19:00:00+03:00", isPaid: false, priceRub: null, capacity: 40 }), published: false },
      { ...event({ id: MOCK_ORGANIZER_PAID_EVENT_ID, title: "Квиз «Мозгобойня»", category: "afisha", city: "Москва", startsAt: "2026-09-06T19:00:00+03:00", isPaid: true, priceRub: 500, paymentUrl: "https://tickets.example.com/mozgoboynya", capacity: 60 }), published: true },
    ],
    places: [{ ...place({ id: "b00000f1-0000-4000-8000-0000000000f1", title: "Лофт на Бауманской", address: "ул. Бауманская, 5", city: "Москва", category: "other", latitude: 55.7717, longitude: 37.6879 }), published: false }],
  };
}

let mockOrganizerState = seedMockOrganizer();
let mockOrganizerSeq = 0;

/** Restore the seeded organizer drafts plus the seeded sales/views addon fixtures (test isolation). */
export function resetMockOrganizer(): void {
  mockOrganizerState = seedMockOrganizer();
  mockOrganizerSeq = 0;
  seedMockOrganizerAddons();
}

const MOCK_ADDON_BOOKING_IDS = ["e00000f2-0000-4000-8000-0000000000f1", "e00000f2-0000-4000-8000-0000000000f2", "e00000f2-0000-4000-8000-0000000000f3"];
const MOCK_ADDON_PAYMENT_IDS = ["700000f2-0000-4000-8000-0000000000f1", "700000f2-0000-4000-8000-0000000000f2"];

/** Seeded addon fixtures for the paid organizer event (fixed ids, re-added idempotently): two settled sales with the commission frozen (backend webhook freeze parity), one cancelled booking, four page views on a fixed past day (never dedup-collides with the test "today"). */
function seedMockOrganizerAddons(): void {
  for (let index = mockBookings.length - 1; index >= 0; index -= 1) {
    if (MOCK_ADDON_BOOKING_IDS.includes(mockBookings[index].id)) mockBookings.splice(index, 1);
  }
  for (let index = mockPayments.length - 1; index >= 0; index -= 1) {
    if (MOCK_ADDON_PAYMENT_IDS.includes(mockPayments[index].id)) mockPayments.splice(index, 1);
  }
  for (let index = mockPageViews.length - 1; index >= 0; index -= 1) {
    if (mockPageViews[index].targetId === MOCK_ORGANIZER_PAID_EVENT_ID) mockPageViews.splice(index, 1);
  }
  const saleBooking = (id: string, userId: string, status: Booking["status"]): Booking => ({ id, userId, eventId: MOCK_ORGANIZER_PAID_EVENT_ID, status, createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP });
  mockBookings.push(saleBooking(MOCK_ADDON_BOOKING_IDS[0], mockFriendIds[0], "active"), saleBooking(MOCK_ADDON_BOOKING_IDS[1], mockFriendIds[1], "active"), saleBooking(MOCK_ADDON_BOOKING_IDS[2], mockFriendIds[2], "cancelled"));
  const frozenSale = (id: string, bookingId: string): Payment => ({ id, bookingId, providerPaymentId: `pay_sandbox_${bookingId}`, status: "succeeded", amountRub: 500, currency: "RUB", description: "Билет: Квиз «Мозгобойня»", commissionRub: 50, netRub: 450, commissionBps: MOCK_COMMISSION_BPS, commissionFixedAt: PLACE_STAMP, createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP });
  mockPayments.push(frozenSale(MOCK_ADDON_PAYMENT_IDS[0], MOCK_ADDON_BOOKING_IDS[0]), frozenSale(MOCK_ADDON_PAYMENT_IDS[1], MOCK_ADDON_BOOKING_IDS[1]));
  for (const viewer of mockFriendIds.slice(0, 4)) mockPageViews.push({ userId: viewer, targetType: "event", targetId: MOCK_ORGANIZER_PAID_EVENT_ID, viewedOn: "2026-08-01" });
}
seedMockOrganizerAddons();

/** Backend EventsService.listMine parity: the demo user's events (drafts included), startsAt ASC then id ASC. */
function organizerEvents(): MockOrganizerEvent[] {
  return [...mockOrganizerState.events].sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
}

/** Backend PlacesService.listMine parity: the demo user's places (drafts included), title ASC then id ASC. */
function organizerPlaces(): MockOrganizerPlace[] {
  return [...mockOrganizerState.places].sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}

/** Backend organizer create parity: the payload is CreateEventSchema-validated by the interceptor; the draft belongs to the demo user. */
function createMockOrganizerEvent(payload: CreateEvent): MockOrganizerEvent {
  mockOrganizerSeq += 1;
  const created: MockOrganizerEvent = { ...payload, id: `f1000000-0000-4000-8000-${String(mockOrganizerSeq).padStart(12, "0")}`, chatLink: null, promoted: false, published: false, bookingOpensAt: null, weather: null };
  mockOrganizerState.events.push(created);
  return created;
}

/** Backend organizer create parity for places. */
function createMockOrganizerPlace(payload: CreatePlace): MockOrganizerPlace {
  mockOrganizerSeq += 1;
  const created: MockOrganizerPlace = { ...payload, id: `f2000000-0000-4000-8000-${String(mockOrganizerSeq).padStart(12, "0")}`, createdAt: PLACE_STAMP, updatedAt: PLACE_STAMP, published: false };
  mockOrganizerState.places.push(created);
  return created;
}

/** Backend organizer publish parity: 404 unknown, 403 when the id is a catalog event not owned by the demo user (ownership emulation), otherwise flips the flag. */
function publishMockOrganizerEvent(id: string): MockOrganizerEvent | "forbidden" | null {
  const found = mockOrganizerState.events.find((item) => item.id === id);
  if (!found) return mockEvents.some((item) => item.id === id) ? "forbidden" : null;
  found.published = true;
  return found;
}

function publishMockOrganizerPlace(id: string): MockOrganizerPlace | "forbidden" | null {
  const found = mockOrganizerState.places.find((item) => item.id === id);
  if (!found) return mockPlaces.some((item) => item.id === id) ? "forbidden" : null;
  found.published = true;
  return found;
}

/** Backend pickEventFields parity. */
const MOCK_EVENT_PATCH_KEYS = ["title", "description", "category", "city", "placeId", "startsAt", "endsAt", "isPaid", "priceRub", "paymentUrl", "capacity"] as const;

/** Backend EventsService.update parity: whitelist patch, merged EventSchema validation; 404 unknown, 403 catalog (not owned). */
function updateMockOrganizerEvent(id: string, patch: Record<string, unknown>): MockOrganizerEvent | "forbidden" | "invalid" | null {
  const found = mockOrganizerState.events.find((item) => item.id === id);
  if (!found) return mockEvents.some((item) => item.id === id) ? "forbidden" : null;
  const picked: Record<string, unknown> = {};
  for (const key of MOCK_EVENT_PATCH_KEYS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) picked[key] = patch[key];
  }
  const merged = EventSchema.safeParse({ ...found, ...picked });
  if (!merged.success || (merged.data.endsAt !== null && new Date(merged.data.endsAt) < new Date(merged.data.startsAt))) return "invalid";
  Object.assign(found, picked);
  return found;
}

/** Backend PlacesService.update parity: CreatePlaceSchema.partial() patch; 404 unknown, 403 catalog (not owned). */
function updateMockOrganizerPlace(id: string, patch: Record<string, unknown>): MockOrganizerPlace | "forbidden" | "invalid" | null {
  const found = mockOrganizerState.places.find((item) => item.id === id);
  if (!found) return mockPlaces.some((item) => item.id === id) ? "forbidden" : null;
  const parsed = CreatePlaceSchema.partial().safeParse(patch);
  if (!parsed.success) return "invalid";
  Object.assign(found, parsed.data);
  return found;
}

/** Ownership emulation for the organizer sub-resources: the demo user's event, "forbidden" for a catalog event owned by someone else, null when unknown (backend requireOwnedEvent parity). */
function mockOwnedEvent(eventId: string): MockOrganizerEvent | "forbidden" | null {
  const own = mockOrganizerState.events.find((item) => item.id === eventId);
  if (own) return own;
  return mockEvents.some((item) => item.id === eventId) ? "forbidden" : null;
}

const ALL_TIME: StatsPeriod = { from: null, to: null };

/** Backend StatsService.inPeriod parity: an inclusive window, null on either side meaning open-ended. */
function mockInPeriod(at: string, period: StatsPeriod): boolean {
  const time = new Date(at).getTime();
  if (period.from !== null && time < new Date(period.from).getTime()) return false;
  if (period.to !== null && time > new Date(period.to).getTime()) return false;
  return true;
}

/** Backend parseStatsPeriod parity: from/to query values into a period, or null when the window is inverted. */
function mockStatsPeriod(url: URL): StatsPeriod | null {
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const parsed = StatsPeriodSchema.safeParse({ from: from === null || from === "" ? null : from, to: to === null || to === "" ? null : to });
  return parsed.success ? parsed.data : null;
}

/** Backend StatsService.eventStats parity: views/bookings/cancellations/paid counters for an owned event over a period; "forbidden" for catalog events, null when unknown. */
function mockOrganizerEventStats(eventId: string, period: StatsPeriod = ALL_TIME): OrganizerEventStats | "forbidden" | null {
  const own = mockOwnedEvent(eventId);
  if (own === null || own === "forbidden") return own;
  const bookings = mockBookings.filter((booking) => booking.eventId === eventId && mockInPeriod(booking.createdAt, period));
  return {
    eventId,
    period,
    views: mockPageViews.filter((view) => view.targetType === "event" && view.targetId === eventId && mockInPeriod(view.viewedOn, period)).length,
    bookings: bookings.length,
    cancellations: bookings.filter((booking) => booking.status === "cancelled").length,
    paidBookings: own.isPaid ? bookings.filter((booking) => booking.status === "active").length : 0,
  };
}

/** Backend PaymentsService.salesReport parity: only succeeded payments with the frozen commission made inside the period make the report; null (404) for unknown and foreign events alike. */
function mockEventSalesReport(eventId: string, period: StatsPeriod = ALL_TIME): EventSalesReport | null {
  if (!mockOrganizerState.events.some((item) => item.id === eventId)) return null;
  const bookingIds = new Set(mockBookings.filter((booking) => booking.eventId === eventId).map((booking) => booking.id));
  const frozen = mockPayments.filter((payment) => bookingIds.has(payment.bookingId) && payment.status === "succeeded" && payment.commissionFixedAt !== null && payment.commissionRub !== null && payment.netRub !== null && payment.commissionBps !== null && mockInPeriod(payment.createdAt, period)).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.id.localeCompare(b.id));
  return {
    eventId,
    period,
    rows: frozen.map((payment) => ({ paymentId: payment.id, bookingId: payment.bookingId, status: payment.status, grossRub: payment.amountRub, commissionRub: payment.commissionRub!, netRub: payment.netRub!, commissionBps: payment.commissionBps!, commissionFixedAt: payment.commissionFixedAt! })),
    grossRub: frozen.reduce((sum, payment) => sum + payment.amountRub, 0),
    commissionRub: frozen.reduce((sum, payment) => sum + (payment.commissionRub ?? 0), 0),
    netRub: frozen.reduce((sum, payment) => sum + (payment.netRub ?? 0), 0),
  };
}

/** Backend MIN_REVIEWS parity: the rating card hides below this review count. */
const MOCK_MIN_RATING_REVIEWS = 3;
const MOCK_ON_TIME_BEFORE_MS = 30 * 60 * 1000;
const MOCK_ON_TIME_AFTER_MS = 15 * 60 * 1000;

/** Backend buildOrganizerRating parity: the catalog fixture organizer owns all catalog events (same convention as eventDetails), the demo user owns the organizer-panel events; null below MIN_REVIEWS, onTimePercent null without past events. */
function mockOrganizerRating(userId: string, now: Date = new Date()): OrganizerRatingResponse {
  const owned: Event[] = userId === mockOrganizers[0].id ? mockEvents : userId === mockDemoUser.id ? mockOrganizerState.events : [];
  const ownedIds = new Set(owned.map((item) => item.id));
  const reviews = mockReviews.filter((item) => item.eventId !== null && ownedIds.has(item.eventId));
  if (reviews.length < MOCK_MIN_RATING_REVIEWS) return { rating: null };
  const checkIns = mockCheckIns.filter((item) => item.eventId !== null && ownedIds.has(item.eventId));
  const past = owned.filter((item) => item.published !== false && new Date(item.startsAt).getTime() <= now.getTime());
  let onTimePercent: number | null = null;
  if (past.length > 0) {
    const onTime = past.filter((item) =>
      checkIns.some((checkIn) => {
        if (checkIn.eventId !== item.id) return false;
        const delta = new Date(checkIn.checkedInAt).getTime() - new Date(item.startsAt).getTime();
        return delta >= -MOCK_ON_TIME_BEFORE_MS && delta <= MOCK_ON_TIME_AFTER_MS;
      }),
    ).length;
    onTimePercent = (onTime / past.length) * 100;
  }
  const rating: OrganizerRating = {
    organizerUserId: userId,
    averageStars: reviews.reduce((sum, item) => sum + item.stars, 0) / reviews.length,
    recommendPercent: (reviews.filter((item) => item.wouldGoAgain).length / reviews.length) * 100,
    visitsCount: checkIns.length,
    onTimePercent,
    reviewsCount: reviews.length,
  };
  return { rating };
}

/** Backend RatingService.forEvent parity: null (404) for unknown or unpublished events; the rating of the event owner otherwise. */
function mockEventOrganizerRating(eventId: string, now: Date = new Date()): OrganizerRatingResponse | null {
  const catalogEvent = mockEvents.find((item) => item.id === eventId);
  if (catalogEvent) return catalogEvent.published === false ? null : mockOrganizerRating(mockOrganizers[0].id, now);
  const ownEvent = mockOrganizerState.events.find((item) => item.id === eventId);
  if (!ownEvent || ownEvent.published === false) return null;
  return mockOrganizerRating(mockDemoUser.id, now);
}

const mockPromoCampaigns: PromoCampaign[] = [];
let mockCampaignSeq = 0;

export function resetMockCampaigns(): void {
  mockPromoCampaigns.length = 0;
  mockCampaignSeq = 0;
}

/** Backend PromoService.listCampaigns parity: createdAt ASC. */
function listMockCampaigns(eventId: string): PromoCampaign[] | "forbidden" | null {
  const owned = mockOwnedEvent(eventId);
  if (owned === null || owned === "forbidden") return owned;
  return mockPromoCampaigns.filter((campaign) => campaign.eventId === eventId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Backend PromoService.createCampaign parity: uppercased code, duplicate code per event -> "duplicate" (409). */
function createMockCampaign(eventId: string, payload: CreatePromoCampaignWrite, now: Date = new Date()): PromoCampaign | "forbidden" | "invalid" | "duplicate" | null {
  const owned = mockOwnedEvent(eventId);
  if (owned === null || owned === "forbidden") return owned;
  const code = payload.code.trim().toUpperCase();
  const title = payload.title.trim();
  if (code === "" || code.length > 40 || title === "") return "invalid";
  if (mockPromoCampaigns.some((campaign) => campaign.eventId === eventId && campaign.code === code)) return "duplicate";
  mockCampaignSeq += 1;
  const campaign: PromoCampaign = { id: `f3000000-0000-4000-8000-${String(mockCampaignSeq).padStart(12, "0")}`, eventId, type: payload.type, status: "active", code, title, maxFulfillments: payload.maxFulfillments ?? null, fulfillmentCount: 0, createdAt: now.toISOString(), completedAt: null };
  mockPromoCampaigns.push(campaign);
  return campaign;
}

const mockPromotionCampaigns: PromotionCampaign[] = [];
let mockPromotionSeq = 0;

export function resetMockPromotions(): void {
  mockPromotionCampaigns.length = 0;
  mockPromotionSeq = 0;
}

/** Backend expireOverdue parity: an active campaign past its endsAt flips to completed. */
function expireMockPromotions(now: Date): void {
  for (const campaign of mockPromotionCampaigns) {
    if (campaign.status !== "active" || new Date(campaign.endsAt).getTime() > now.getTime()) continue;
    campaign.status = "completed";
    campaign.completedAt = campaign.endsAt;
  }
}

/** Backend PromotionService.list parity: startsAt ASC then id ASC, with lazy expiry. */
function listMockPromotions(eventId: string, now: Date = new Date()): PromotionCampaign[] | "forbidden" | null {
  const owned = mockOwnedEvent(eventId);
  if (owned === null || owned === "forbidden") return owned;
  expireMockPromotions(now);
  return mockPromotionCampaigns.filter((campaign) => campaign.eventId === eventId).sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
}

/** Backend PromotionService.create parity: a campaign already past its window is created completed; the payload refines (period, audience) are validated by the interceptor. */
function createMockPromotion(eventId: string, payload: CreatePromotionWrite, now: Date = new Date()): PromotionCampaign | "forbidden" | "invalid" | null {
  const owned = mockOwnedEvent(eventId);
  if (owned === null || owned === "forbidden") return owned;
  if (new Date(payload.endsAt).getTime() <= new Date(payload.startsAt).getTime()) return "invalid";
  if (payload.type === "target_collection" && payload.audience == null) return "invalid";
  const tariffCode = payload.tariffCode.trim();
  if (tariffCode === "") return "invalid";
  const expired = new Date(payload.endsAt).getTime() <= now.getTime();
  mockPromotionSeq += 1;
  const campaign: PromotionCampaign = { id: `f4000000-0000-4000-8000-${String(mockPromotionSeq).padStart(12, "0")}`, eventId, type: payload.type, status: expired ? "completed" : "active", startsAt: payload.startsAt, endsAt: payload.endsAt, tariffCode, priceRub: payload.priceRub, paidAt: null, audience: payload.audience ?? null, createdAt: now.toISOString(), completedAt: expired ? payload.endsAt : null };
  mockPromotionCampaigns.push(campaign);
  return campaign;
}

/** Backend PromotionService.recordPayment parity: manual paid stamp; "no_campaign" when the campaign is not on this event. */
function payMockPromotion(eventId: string, campaignId: string, paidAt: string | undefined, now: Date = new Date()): PromotionCampaign | "forbidden" | "no_campaign" | null {
  const owned = mockOwnedEvent(eventId);
  if (owned === null || owned === "forbidden") return owned;
  const campaign = mockPromotionCampaigns.find((item) => item.id === campaignId && item.eventId === eventId);
  if (!campaign) return "no_campaign";
  expireMockPromotions(now);
  campaign.paidAt = paidAt ?? now.toISOString();
  return campaign;
}

const mockOrganizerPromoCodes: PromoCode[] = [];
let mockPromoCodeSeq = 0;

export function resetMockPromoCodes(): void {
  mockOrganizerPromoCodes.length = 0;
  mockPromoCodeSeq = 0;
}

/** Backend PromoService.list parity: createdAt ASC. */
function listMockPromoCodes(eventId: string): PromoCode[] | "forbidden" | null {
  const owned = mockOwnedEvent(eventId);
  if (owned === null || owned === "forbidden") return owned;
  return mockOrganizerPromoCodes.filter((code) => code.eventId === eventId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Backend PromoService.create parity: uppercased code, duplicate code per event -> "duplicate" (409). */
function createMockPromoCode(eventId: string, payload: CreatePromoCodeWrite, now: Date = new Date()): PromoCode | "forbidden" | "invalid" | "duplicate" | null {
  const owned = mockOwnedEvent(eventId);
  if (owned === null || owned === "forbidden") return owned;
  const code = payload.code.trim().toUpperCase();
  if (code === "" || code.length > 40) return "invalid";
  if (mockOrganizerPromoCodes.some((item) => item.eventId === eventId && item.code === code)) return "duplicate";
  mockPromoCodeSeq += 1;
  const created: PromoCode = { id: `f2000000-0000-4000-8000-${String(mockPromoCodeSeq).padStart(12, "0")}`, eventId, code, maxRedemptions: payload.maxRedemptions ?? null, redeemedCount: 0, expiresAt: payload.expiresAt ?? null, createdAt: now.toISOString() };
  mockOrganizerPromoCodes.push(created);
  return created;
}

/** Backend PromoService.setEarlyAccess parity: sets the owned event's booking window. */
function setMockEarlyAccess(eventId: string, bookingOpensAt: string): { bookingOpensAt: string } | "forbidden" | null {
  const owned = mockOwnedEvent(eventId);
  if (owned === null || owned === "forbidden") return owned;
  owned.bookingOpensAt = bookingOpensAt;
  return { bookingOpensAt };
}

export function installMockApi(): () => void {
  const real = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (input instanceof Request) return real(input, init);
    const url = new URL(input, "http://mock.local");
    if (url.pathname === "/api/stories" && init?.method === "POST") {
      const body = parseBookingBody(init);
      const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl : null;
      if (imageUrl === null || imageUrl === "") return new Response(null, { status: 400 });
      return Response.json(createMockStory(imageUrl));
    }
    if (url.pathname === "/api/stories") {
      return Response.json(listMockStories());
    }
    if (url.pathname === "/api/auth/organizer/login") {
      const parsed = OrganizerLoginWriteSchema.safeParse(parseBookingBody(init));
      if (!parsed.success || parsed.data.login !== MOCK_ORGANIZER_CREDENTIALS.login || parsed.data.password !== MOCK_ORGANIZER_CREDENTIALS.password) return new Response(null, { status: 401 });
      return Response.json({ token: "mock-organizer-token", organization: mockOrganization } satisfies OrganizerSession);
    }
    if (url.pathname === "/api/friends/activity") {
      return Response.json(friendActivityByFriend());
    }
    if (url.pathname === "/api/friends") {
      return Response.json(mockFriends);
    }
    if (url.pathname === "/api/today") {
      return Response.json(todayPicks());
    }
    if (url.pathname === "/api/whereto") {
      const parsed = WheretoQuerySchema.safeParse({ company: url.searchParams.get("company"), mood: url.searchParams.get("mood"), budget: url.searchParams.get("budget") });
      if (!parsed.success) return new Response(null, { status: 400 });
      return Response.json(wheretoSuggestions(parsed.data));
    }
    if (url.pathname === "/api/nearby/free") {
      const coords = parseMockCoords(url);
      const hours = Number(url.searchParams.get("hours"));
      const mood = LeisureMoodSchema.safeParse(url.searchParams.get("mood"));
      if (coords === null || !Number.isInteger(hours) || hours < 1 || hours > 8 || !mood.success) return new Response(null, { status: 400 });
      return Response.json(leisureOptions(hours, mood.data, coords[0], coords[1]));
    }
    if (url.pathname === "/api/nearby") {
      const coords = parseMockCoords(url);
      if (coords === null) return new Response(null, { status: 400 });
      return Response.json(nearbyTimeline(coords[0], coords[1]));
    }
    const discoveryRoute = /^\/api\/discovery\/friends\/([^/]+)\/route$/.exec(url.pathname);
    if (discoveryRoute) {
      if (!IdSchema.safeParse(discoveryRoute[1]).success) return new Response(null, { status: 400 });
      const route = friendRoute(discoveryRoute[1]);
      if (route === "own" || route === "hidden") return new Response(null, { status: 403 });
      if (route === "not_friend") return new Response(null, { status: 404 });
      return Response.json(route);
    }
    if (url.pathname === "/api/discovery") {
      return Response.json(discoverySummary());
    }
    if (url.pathname === "/api/people") {
      const origin = parseMockOrigin(url);
      if (origin === "invalid") return new Response(null, { status: 400 });
      const [latitude, longitude] = origin ?? MOCK_PEOPLE_CENTER;
      return Response.json(peopleSuggest(latitude, longitude));
    }
    if (url.pathname === "/api/promotions/placements") {
      return Response.json(mockPromotionPlacements());
    }
    if (url.pathname === "/api/promotions/for-me") {
      return Response.json(mockTargetedPromotions());
    }
    if (url.pathname === "/api/places") {
      return Response.json(mockPlaces);
    }
    const placePage = /^\/api\/places\/([^/]+)\/page$/.exec(url.pathname);
    if (placePage) {
      const page = placePageFor(placePage[1], url.searchParams.get("userId") ?? "");
      return page ? Response.json(page) : new Response(null, { status: 404 });
    }
    const placeById = /^\/api\/places\/([^/]+)$/.exec(url.pathname);
    if (placeById && (init?.method ?? "GET") === "GET" && IdSchema.safeParse(placeById[1]).success) {
      const found = mockPlaces.find((item) => item.id === placeById[1]);
      return found ? Response.json(found) : new Response(null, { status: 404 });
    }
    if (url.pathname === "/api/events") {
      const events = filterMockEvents(mockEvents, parseEventFilters(url.search))
        .map(eventPromoted)
        .sort((a, b) => Number(MOCK_BOOSTED_EVENT_IDS.has(b.id)) - Number(MOCK_BOOSTED_EVENT_IDS.has(a.id)) || Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id));
      return Response.json(events);
    }
    const details = /^\/api\/events\/([^/]+)\/details$/.exec(url.pathname);
    if (details) {
      const payload = eventDetails(details[1], url.searchParams.get("userId") ?? "");
      return payload ? Response.json(payload) : new Response(null, { status: 404 });
    }
    const byId = /^\/api\/events\/([^/]+)$/.exec(url.pathname);
    if (byId && init?.method === "PATCH") {
      const result = updateMockOrganizerEvent(byId[1], parseBookingBody(init) ?? {});
      return result === null ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : result === "invalid" ? new Response(null, { status: 400 }) : Response.json(result);
    }
    if (byId) {
      const found = mockEvents.find((item) => item.id === byId[1]);
      return found ? Response.json(eventPromoted(found)) : new Response(null, { status: 404 });
    }
    const rating = /^\/api\/events\/([^/]+)\/rating$/.exec(url.pathname);
    if (rating) {
      const payload = eventRating(rating[1]);
      return payload ? Response.json(payload) : new Response(null, { status: 404 });
    }
    const stats = /^\/api\/events\/([^/]+)\/participation\/stats$/.exec(url.pathname);
    if (stats) {
      if (!mockEvents.some((item) => item.id === stats[1])) return new Response(null, { status: 404 });
      return Response.json(participationStats(stats[1], url.searchParams.get("userId") ?? ""));
    }
    const participation = /^\/api\/events\/([^/]+)\/participation$/.exec(url.pathname);
    if (participation && init?.method === "PUT") {
      const userId = url.searchParams.get("userId") ?? "";
      const parsed = ParticipationStatusSchema.safeParse(parseBookingBody(init)?.status);
      if (!parsed.success || userId === "") return new Response(null, { status: 400 });
      if (!mockEvents.some((item) => item.id === participation[1])) return new Response(null, { status: 404 });
      const now = new Date().toISOString();
      const key = `${userId}:${participation[1]}`;
      const existing = mockParticipations.get(key);
      mockParticipationSeq += 1;
      const record: Participation = existing ? { ...existing, status: parsed.data, updatedAt: now } : { id: `f0000000-0000-4000-8000-${String(mockParticipationSeq).padStart(12, "0")}`, userId, eventId: participation[1], status: parsed.data, createdAt: now, updatedAt: now };
      mockParticipations.set(key, record);
      return Response.json(record);
    }
    if (participation && init?.method === "DELETE") {
      const key = `${url.searchParams.get("userId") ?? ""}:${participation[1]}`;
      const existing = mockParticipations.get(key);
      if (!existing) return new Response(null, { status: 404 });
      mockParticipations.delete(key);
      return Response.json(existing);
    }
    if (url.pathname === "/api/profile" && init?.method === "PATCH") {
      const parsed = UpdateProfileSchema.safeParse(parseBookingBody(init));
      if (!parsed.success) return new Response(null, { status: 400 });
      const current = profileFor(mockDemoUser.id);
      const updated: Profile = { ...current, ...parsed.data, smartAlerts: { ...current.smartAlerts, ...parsed.data.smartAlerts }, privacy: { ...current.privacy, ...parsed.data.privacy }, recommendationsEnabled: parsed.data.recommendationsEnabled ?? current.recommendationsEnabled };
      mockProfiles.set(mockDemoUser.id, updated);
      return Response.json(updated);
    }
    if (url.pathname === "/api/profile") {
      return Response.json(profileFor(mockDemoUser.id));
    }
    if (url.pathname === "/api/bookings" && init?.method === "POST") {
      const parsed = CreateBookingSchema.safeParse(parseBookingBody(init));
      if (!parsed.success) return new Response(null, { status: 400 });
      if (!mockEvents.some((item) => item.id === parsed.data.eventId)) return new Response(null, { status: 404 });
      const existing = mockBookings.find((booking) => booking.eventId === parsed.data.eventId && booking.userId === parsed.data.userId && booking.status === "active");
      if (existing) return new Response(null, { status: 409 });
      if (remainingSeats(parsed.data.eventId) === 0) return new Response(null, { status: 409 });
      const promo = redeemMockPromoCode(parsed.data.eventId, parsed.data.promoCode);
      if (promo === "forbidden") return new Response(null, { status: 403 });
      const now = new Date().toISOString();
      mockBookingSeq += 1;
      const booking: Booking = { id: `e0000000-0000-4000-8000-${String(mockBookingSeq).padStart(12, "0")}`, userId: parsed.data.userId, eventId: parsed.data.eventId, status: "active", createdAt: now, updatedAt: now };
      mockBookings.push(booking);
      ensureMockPayment(booking, now);
      return Response.json(mockBookingWithSeats(booking));
    }
    const payBooking = /^\/api\/bookings\/([^/]+)\/payment$/.exec(url.pathname);
    if (payBooking && init?.method === "POST") {
      const booking = mockBookings.find((item) => item.id === payBooking[1]);
      if (!booking) return new Response(null, { status: 404 });
      if (booking.status !== "active") return new Response(null, { status: 409 });
      const now = new Date().toISOString();
      const payment = ensureMockPayment(booking, now);
      if (payment !== null) settleMockPayment(payment, now);
      return Response.json(mockBookingWithSeats(booking));
    }
    if (url.pathname === "/api/calendar") {
      const entries = calendarEntries(mockDemoUser.id);
      const now = Date.now();
      const byStartAsc = (a: (typeof entries)[number], b: (typeof entries)[number]) => a.event.startsAt.localeCompare(b.event.startsAt);
      return Response.json({
        upcoming: entries.filter((entry) => new Date(entry.event.startsAt).getTime() >= now).sort(byStartAsc),
        past: entries.filter((entry) => new Date(entry.event.startsAt).getTime() < now).sort((a, b) => -byStartAsc(a, b)),
      });
    }
    if (url.pathname === "/api/check-ins" && init?.method === "POST") {
      const payload = parseBookingBody(init) as { userId?: string; eventId?: string; placeId?: string } | undefined;
      if (typeof payload !== "object" || payload === null || typeof payload.userId !== "string") return new Response(null, { status: 400 });
      const result = createMockCheckIn(payload.userId, { eventId: payload.eventId, placeId: payload.placeId });
      return result === "invalid" ? new Response(null, { status: 400 }) : result === "no_target" ? new Response(null, { status: 404 }) : Response.json(result);
    }
    const visitStats = /^\/api\/users\/([^/]+)\/visit-stats$/.exec(url.pathname);
    if (visitStats) {
      return Response.json(visitStatsFor(visitStats[1]));
    }
    const achievements = /^\/api\/users\/([^/]+)\/achievements$/.exec(url.pathname);
    if (achievements) {
      return Response.json(achievementsFor(visitStatsFor(achievements[1])));
    }
    const myCity = /^\/api\/users\/([^/]+)\/my-city$/.exec(url.pathname);
    if (myCity) {
      return Response.json(myCityFor(myCity[1]));
    }
    const cancel = /^\/api\/bookings\/([^/]+)$/.exec(url.pathname);
    if (cancel && init?.method === "DELETE") {
      // ponytail: wontfix ownership check (backend -> 403 for a foreign user) — the mock has no auth context on
      // DELETE /bookings/:id (ApiClient.cancelBooking sends no actor id), so an owner assert is not enforceable without
      // expanding the client surface; the sandbox is single-identity (everything acts as mockDemoUser).
      const booking = mockBookings.find((item) => item.id === cancel[1]);
      if (!booking) return new Response(null, { status: 404 });
      if (booking.status !== "cancelled") {
        booking.status = "cancelled";
        booking.updatedAt = new Date().toISOString();
        offerNextMockWaitlist(booking.eventId, new Date());
      }
      // refundForBooking parity: a succeeded payment is refunded (idempotent), other statuses pass through
      const payment = mockPayments.find((item) => item.bookingId === booking.id);
      if (payment?.status === "succeeded") {
        payment.status = "refunded";
        payment.updatedAt = new Date().toISOString();
      }
      return Response.json(mockBookingWithSeats(booking));
    }
    if (url.pathname === "/api/friends/availability") {
      if (!url.searchParams.get("eventId")) return new Response(null, { status: 400 });
      return Response.json(friendAvailability());
    }
    if (url.pathname === "/api/gatherings" && init?.method === "POST") {
      const payload = parseBookingBody(init) as CreateGathering | undefined;
      if (typeof payload !== "object" || payload === null || !Array.isArray(payload.friendIds)) return new Response(null, { status: 400 });
      if (!mockEvents.some((item) => item.id === payload.eventId)) return new Response(null, { status: 404 });
      const gathering = createMockGathering(payload);
      return gathering ? Response.json(gathering) : new Response(null, { status: 400 });
    }
    const gatheringResponse = /^\/api\/gatherings\/([^/]+)\/response$/.exec(url.pathname);
    if (gatheringResponse && init?.method === "PATCH") {
      if (!IdSchema.safeParse(gatheringResponse[1]).success) return new Response(null, { status: 400 });
      const parsed = GatheringResponseWriteSchema.safeParse(parseBookingBody(init));
      if (!parsed.success) return new Response(null, { status: 400 });
      const result = respondMockGathering(gatheringResponse[1], parsed.data.response);
      return result === "unknown" ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : Response.json(result);
    }
    const gathering = /^\/api\/gatherings\/([^/]+)$/.exec(url.pathname);
    if (gathering) {
      const found = mockGatherings.get(gathering[1]);
      return found ? Response.json(found) : new Response(null, { status: 404 });
    }
    if (url.pathname === "/api/votes" && init?.method === "POST") {
      const parsed = CreateVoteWriteSchema.safeParse(parseBookingBody(init));
      if (!parsed.success) return new Response(null, { status: 400 });
      const created = createMockVote(parsed.data);
      return created === "invalid" ? new Response(null, { status: 400 }) : created === "no_event" ? new Response(null, { status: 404 }) : Response.json(created);
    }
    const voteBallots = /^\/api\/votes\/([^/]+)\/ballots$/.exec(url.pathname);
    if (voteBallots && init?.method === "POST") {
      if (!IdSchema.safeParse(voteBallots[1]).success) return new Response(null, { status: 400 });
      const parsed = VoteBallotWriteSchema.safeParse(parseBookingBody(init));
      if (!parsed.success) return new Response(null, { status: 400 });
      const result = castMockBallot(voteBallots[1], parsed.data.eventId);
      return result === "unknown" ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : result === "invalid" ? new Response(null, { status: 400 }) : Response.json(result);
    }
    const voteById = /^\/api\/votes\/([^/]+)$/.exec(url.pathname);
    if (voteById) {
      if (!IdSchema.safeParse(voteById[1]).success) return new Response(null, { status: 400 });
      const result = getMockVote(voteById[1]);
      return result === "unknown" ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : Response.json(result);
    }
    if (url.pathname === "/api/plans/auto" && init?.method === "POST") {
      const parsed = CreateAutoPlanWriteSchema.safeParse(parseBookingBody(init));
      if (!parsed.success) return new Response(null, { status: 400 });
      const proposal = createMockAutoPlan(parsed.data);
      return proposal === "no_event" ? new Response(null, { status: 404 }) : Response.json(proposal);
    }
    if (url.pathname === "/api/routes" && init?.method === "POST") {
      const parsed = CreateDayRouteWriteSchema.safeParse(parseBookingBody(init));
      if (!parsed.success) return new Response(null, { status: 400 });
      const route = buildMockDayRoute(parsed.data);
      if (route === "no_event" || route === "no_place") return new Response(null, { status: 404 });
      if (route === "event_without_place") return new Response(null, { status: 400 });
      return Response.json(route);
    }
    if (url.pathname === "/api/routes/optimize" && init?.method === "POST") {
      const parsed = CreateDayRouteWriteSchema.safeParse(parseBookingBody(init));
      if (!parsed.success) return new Response(null, { status: 400 });
      const result = optimizeMockDayRoute(parsed.data);
      if (result === "no_event" || result === "no_place") return new Response(null, { status: 404 });
      if (result === "event_without_place") return new Response(null, { status: 400 });
      return Response.json(result);
    }
    if (url.pathname === "/api/plans") {
      return Response.json(planCards());
    }
    const planBudget = /^\/api\/plans\/([^/]+)\/budget$/.exec(url.pathname);
    if (planBudget) {
      if (!IdSchema.safeParse(planBudget[1]).success) return new Response(null, { status: 400 });
      const budget = mockPlanBudget(planBudget[1]);
      return budget ? Response.json(budget) : new Response(null, { status: 404 });
    }
    const planExpenses = /^\/api\/plans\/([^/]+)\/expenses$/.exec(url.pathname);
    if (planExpenses && init?.method === "POST") {
      if (!IdSchema.safeParse(planExpenses[1]).success) return new Response(null, { status: 400 });
      const parsed = CreatePlanExpenseWriteSchema.safeParse(parseBookingBody(init));
      if (!parsed.success) return new Response(null, { status: 400 });
      const budget = addMockPlanExpense(planExpenses[1], parsed.data);
      return budget === null ? new Response(null, { status: 404 }) : budget === "invalid" ? new Response(null, { status: 400 }) : Response.json(budget);
    }
    if (url.pathname === "/api/we-groups" && init?.method === "POST") {
      const parsed = CreateWeGroupWriteSchema.safeParse(parseBookingBody(init));
      if (!parsed.success || parsed.data.title.trim() === "") return new Response(null, { status: 400 });
      const created = createMockWeGroup(parsed.data);
      return created === "unknown_user" ? new Response(null, { status: 404 }) : Response.json(created);
    }
    if (url.pathname === "/api/we-groups") {
      return Response.json(listMockWeGroups());
    }
    const weGroupAction = /^\/api\/we-groups\/([^/]+)\/(events|places|archive)$/.exec(url.pathname);
    if (weGroupAction && init?.method === "POST") {
      if (!IdSchema.safeParse(weGroupAction[1]).success) return new Response(null, { status: 400 });
      if (weGroupAction[2] === "archive") {
        const archived = archiveMockWeGroup(weGroupAction[1]);
        return archived === "unknown" ? new Response(null, { status: 404 }) : archived === "forbidden" ? new Response(null, { status: 403 }) : Response.json(archived);
      }
      const body = parseBookingBody(init);
      const itemId = body?.[weGroupAction[2] === "events" ? "eventId" : "placeId"];
      const parsedId = IdSchema.safeParse(itemId);
      if (!parsedId.success) return new Response(null, { status: 400 });
      const bound = bindMockWeGroupItem(weGroupAction[1], weGroupAction[2] === "events" ? "event" : "place", parsedId.data);
      return bound === "unknown" || bound === "no_target" ? new Response(null, { status: 404 }) : bound === "forbidden" ? new Response(null, { status: 403 }) : bound === "archived" ? new Response(null, { status: 409 }) : Response.json(bound);
    }
    const weGroupById = /^\/api\/we-groups\/([^/]+)$/.exec(url.pathname);
    if (weGroupById) {
      if (!IdSchema.safeParse(weGroupById[1]).success) return new Response(null, { status: 400 });
      const screen = getMockWeGroup(weGroupById[1]);
      return screen === "unknown" ? new Response(null, { status: 404 }) : screen === "forbidden" ? new Response(null, { status: 403 }) : Response.json(screen);
    }
    const plan = /^\/api\/plans\/([^/]+)$/.exec(url.pathname);
    if (plan) {
      const found = planCard(plan[1]);
      return found ? Response.json(found) : new Response(null, { status: 404 });
    }
    const listById = /^\/api\/lists\/([^/]+)$/.exec(url.pathname);
    if (listById) {
      const screen = listScreen(listById[1]);
      return screen ? Response.json(screen) : new Response(null, { status: 404 });
    }
    if (url.pathname === "/api/lists") {
      return Response.json(listSummaries(url.searchParams.get("userId") ?? "", url.searchParams.get("eventId")));
    }
    const listItems = /^\/api\/lists\/([^/]+)\/items$/.exec(url.pathname);
    if (listItems && init?.method === "POST") {
      const payload = parseBookingBody(init) as AddListItem | undefined;
      if (typeof payload !== "object" || payload === null || typeof payload.userId !== "string" || payload.userId === "" || typeof payload.eventId !== "string") return new Response(null, { status: 400 });
      const result = addMockListItem(listItems[1], payload);
      return result === "no_list" || result === "no_event" ? new Response(null, { status: 404 }) : Response.json(result);
    }
    if (listItems) {
      const cards = listItemCards(listItems[1]);
      return cards ? Response.json(cards) : new Response(null, { status: 404 });
    }
    const listItemRemove = /^\/api\/lists\/([^/]+)\/items\/([^/]+)$/.exec(url.pathname);
    if (listItemRemove && init?.method === "DELETE") {
      const removed = removeMockListItem(listItemRemove[1], listItemRemove[2]);
      return removed ? Response.json(removed) : new Response(null, { status: 404 });
    }
    if (url.pathname === "/api/reviews" && init?.method === "POST") {
      const payload = parseBookingBody(init) as CreateReview | undefined;
      if (typeof payload !== "object" || payload === null || typeof payload.userId !== "string" || typeof payload.eventId !== "string" || typeof payload.stars !== "number" || typeof payload.wouldGoAgain !== "boolean") return new Response(null, { status: 400 });
      const result = createMockReview(payload);
      return result === "no_event" ? new Response(null, { status: 404 }) : result === "invalid" ? new Response(null, { status: 400 }) : Response.json(result);
    }
    if (url.pathname === "/api/reports" && init?.method === "POST") {
      const payload = parseBookingBody(init) as CreateReport | undefined;
      if (typeof payload !== "object" || payload === null || typeof payload.userId !== "string" || typeof payload.reason !== "string") return new Response(null, { status: 400 });
      const result = createMockReport(payload as CreateReport);
      return result === "no_target" ? new Response(null, { status: 404 }) : result === "invalid" ? new Response(null, { status: 400 }) : result === "duplicate" ? new Response(null, { status: 409 }) : Response.json(result);
    }
    if (url.pathname === "/api/micro-events" && init?.method === "POST") {
      const payload = parseBookingBody(init) as CreateMicroEvent | undefined;
      if (typeof payload !== "object" || payload === null || typeof payload.userId !== "string" || typeof payload.title !== "string" || typeof payload.startsAt !== "string" || typeof payload.participantsLimit !== "number") return new Response(null, { status: 400 });
      const result = createMockMicroEvent(payload);
      return result === "no_place" ? new Response(null, { status: 404 }) : result === "invalid" ? new Response(null, { status: 400 }) : Response.json(result);
    }
    if (url.pathname === "/api/micro-events") {
      return Response.json(microEvents());
    }
    const microJoin = /^\/api\/micro-events\/([^/]+)\/join$/.exec(url.pathname);
    if (microJoin && init?.method === "POST") {
      const userId = url.searchParams.get("userId") ?? "";
      if (userId === "") return new Response(null, { status: 400 });
      const result = joinMockMicroEvent(microJoin[1], userId);
      return result === null ? new Response(null, { status: 404 }) : result === "full" || result === "closed" ? new Response(null, { status: 409 }) : Response.json(result);
    }
    if (microJoin && init?.method === "DELETE") {
      const userId = url.searchParams.get("userId") ?? "";
      if (userId === "") return new Response(null, { status: 400 });
      const result = leaveMockMicroEvent(microJoin[1], userId);
      return result === null ? new Response(null, { status: 404 }) : Response.json(result);
    }
    if (url.pathname === "/api/feed" && init?.method === "POST") {
      const payload = parseBookingBody(init) as CreateFeedPost | undefined;
      if (typeof payload !== "object" || payload === null || typeof payload.userId !== "string" || payload.userId === "" || typeof payload.eventId !== "string" || typeof payload.text !== "string" || payload.text.trim() === "") return new Response(null, { status: 400 });
      const post = createMockFeedPost(payload);
      return post ? Response.json(post) : new Response(null, { status: 404 });
    }
    if (url.pathname === "/api/feed") {
      return Response.json(feedPosts(url.searchParams.get("eventId"), url.searchParams.get("placeId")));
    }
    const feedLike = /^\/api\/feed\/([^/]+)\/like$/.exec(url.pathname);
    if (feedLike && init?.method === "POST") {
      const userId = url.searchParams.get("userId") ?? "";
      if (userId === "") return new Response(null, { status: 400 });
      const post = toggleMockFeedLike(feedLike[1], userId);
      return post ? Response.json(post) : new Response(null, { status: 404 });
    }
    const feedComment = /^\/api\/feed\/([^/]+)\/comments$/.exec(url.pathname);
    if (feedComment && init?.method === "POST") {
      const payload = parseBookingBody(init) as { userId?: string; text?: string } | undefined;
      if (typeof payload !== "object" || payload === null || typeof payload.userId !== "string" || payload.userId === "" || typeof payload.text !== "string" || payload.text.trim() === "") return new Response(null, { status: 400 });
      const post = addMockFeedComment(feedComment[1], { userId: payload.userId, text: payload.text });
      return post ? Response.json(post) : new Response(null, { status: 404 });
    }
    if (url.pathname === "/api/waitlist" && init?.method === "POST") {
      const userId = url.searchParams.get("userId") ?? "";
      const payload = parseBookingBody(init) as { eventId?: string } | undefined;
      if (userId === "" || typeof payload !== "object" || payload === null || typeof payload.eventId !== "string") return new Response(null, { status: 400 });
      const result = joinMockWaitlist(payload.eventId, userId);
      return result === "no_event" ? new Response(null, { status: 404 }) : typeof result === "string" ? new Response(null, { status: 409 }) : Response.json(result);
    }
    if (url.pathname === "/api/waitlist/me") {
      const eventId = url.searchParams.get("eventId") ?? "";
      const userId = url.searchParams.get("userId") ?? "";
      if (eventId === "" || userId === "") return new Response(null, { status: 400 });
      const entry = myMockWaitlistEntry(eventId, userId);
      return entry ? Response.json(entry) : new Response(null, { status: 404 });
    }
    const waitlistAction = /^\/api\/waitlist\/([^/]+)\/(confirm|decline)$/.exec(url.pathname);
    if (waitlistAction && init?.method === "POST") {
      if (waitlistAction[2] === "confirm") {
        const result = confirmMockWaitlistOffer(waitlistAction[1]);
        return result === null ? new Response(null, { status: 404 }) : typeof result === "string" ? new Response(null, { status: 409 }) : Response.json(result);
      }
      const result = declineMockWaitlistOffer(waitlistAction[1]);
      return result === null ? new Response(null, { status: 404 }) : typeof result === "string" ? new Response(null, { status: 409 }) : Response.json(result);
    }
    if (url.pathname === "/api/organizer/events" && init?.method === "POST") {
      const parsed = CreateEventSchema.safeParse(parseBookingBody(init));
      if (!parsed.success || (parsed.data.endsAt && new Date(parsed.data.endsAt) < new Date(parsed.data.startsAt))) return new Response(null, { status: 400 });
      return Response.json(createMockOrganizerEvent(parsed.data));
    }
    if (url.pathname === "/api/organizer/events") {
      return Response.json(organizerEvents());
    }
    const organizerEventPublish = /^\/api\/organizer\/events\/([^/]+)\/publish$/.exec(url.pathname);
    if (organizerEventPublish && init?.method === "POST") {
      const result = publishMockOrganizerEvent(organizerEventPublish[1]);
      return result === null ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : Response.json(result);
    }
    if (url.pathname === "/api/organizer/places" && init?.method === "POST") {
      const parsed = CreatePlaceSchema.safeParse(parseBookingBody(init));
      if (!parsed.success) return new Response(null, { status: 400 });
      return Response.json(createMockOrganizerPlace(parsed.data));
    }
    if (url.pathname === "/api/organizer/places") {
      return Response.json(organizerPlaces());
    }
    const organizerPlacePublish = /^\/api\/organizer\/places\/([^/]+)\/publish$/.exec(url.pathname);
    if (organizerPlacePublish && init?.method === "POST") {
      const result = publishMockOrganizerPlace(organizerPlacePublish[1]);
      return result === null ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : Response.json(result);
    }
    const organizerPlacePatch = /^\/api\/places\/([^/]+)$/.exec(url.pathname);
    if (organizerPlacePatch && init?.method === "PATCH") {
      const result = updateMockOrganizerPlace(organizerPlacePatch[1], parseBookingBody(init) ?? {});
      return result === null ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : result === "invalid" ? new Response(null, { status: 400 }) : Response.json(result);
    }
    if (url.pathname === "/api/views" && init?.method === "POST") {
      const parsed = RecordPageViewWriteSchema.safeParse(parseBookingBody(init));
      if (!parsed.success) return new Response(null, { status: 400 });
      return Response.json(recordMockPageView(mockDemoUser.id, parsed.data));
    }
    const organizerEventStats = /^\/api\/organizer\/events\/([^/]+)\/stats$/.exec(url.pathname);
    if (organizerEventStats) {
      if (!IdSchema.safeParse(organizerEventStats[1]).success) return new Response(null, { status: 400 });
      const period = mockStatsPeriod(url);
      if (period === null) return new Response(null, { status: 400 });
      const result = mockOrganizerEventStats(organizerEventStats[1], period);
      return result === null ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : Response.json(result);
    }
    const organizerEventSales = /^\/api\/organizer\/events\/([^/]+)\/sales$/.exec(url.pathname);
    if (organizerEventSales) {
      if (!IdSchema.safeParse(organizerEventSales[1]).success) return new Response(null, { status: 400 });
      const period = mockStatsPeriod(url);
      if (period === null) return new Response(null, { status: 400 });
      const result = mockEventSalesReport(organizerEventSales[1], period);
      return result === null ? new Response(null, { status: 404 }) : Response.json(result);
    }
    const eventOrganizerRating = /^\/api\/events\/([^/]+)\/organizer-rating$/.exec(url.pathname);
    if (eventOrganizerRating) {
      if (!IdSchema.safeParse(eventOrganizerRating[1]).success) return new Response(null, { status: 400 });
      const result = mockEventOrganizerRating(eventOrganizerRating[1]);
      return result === null ? new Response(null, { status: 404 }) : Response.json(result);
    }
    const organizerRating = /^\/api\/organizers\/([^/]+)\/rating$/.exec(url.pathname);
    if (organizerRating) {
      if (!IdSchema.safeParse(organizerRating[1]).success) return new Response(null, { status: 400 });
      return Response.json(mockOrganizerRating(organizerRating[1]));
    }
    const organizerCampaigns = /^\/api\/organizer\/events\/([^/]+)\/campaigns$/.exec(url.pathname);
    if (organizerCampaigns && init?.method === "POST") {
      const parsed = CreatePromoCampaignWriteSchema.safeParse(parseBookingBody(init));
      if (!parsed.success) return new Response(null, { status: 400 });
      const result = createMockCampaign(organizerCampaigns[1], parsed.data);
      return result === null ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : result === "invalid" ? new Response(null, { status: 400 }) : result === "duplicate" ? new Response(null, { status: 409 }) : Response.json(result);
    }
    if (organizerCampaigns) {
      const result = listMockCampaigns(organizerCampaigns[1]);
      return result === null ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : Response.json(result);
    }
    const organizerPromotionPaid = /^\/api\/organizer\/events\/([^/]+)\/promotions\/([^/]+)\/paid$/.exec(url.pathname);
    if (organizerPromotionPaid && init?.method === "POST") {
      const parsed = RecordPromotionPaymentWriteSchema.safeParse(parseBookingBody(init) ?? {});
      if (!parsed.success) return new Response(null, { status: 400 });
      const result = payMockPromotion(organizerPromotionPaid[1], organizerPromotionPaid[2], parsed.data.paidAt);
      return result === null || result === "no_campaign" ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : Response.json(result);
    }
    const organizerPromotions = /^\/api\/organizer\/events\/([^/]+)\/promotions$/.exec(url.pathname);
    if (organizerPromotions && init?.method === "POST") {
      const parsed = CreatePromotionWriteSchema.safeParse(parseBookingBody(init));
      if (!parsed.success) return new Response(null, { status: 400 });
      const result = createMockPromotion(organizerPromotions[1], parsed.data);
      return result === null ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : result === "invalid" ? new Response(null, { status: 400 }) : Response.json(result);
    }
    if (organizerPromotions) {
      const result = listMockPromotions(organizerPromotions[1]);
      return result === null ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : Response.json(result);
    }
    const organizerPromocodes = /^\/api\/organizer\/events\/([^/]+)\/promocodes$/.exec(url.pathname);
    if (organizerPromocodes && init?.method === "POST") {
      const parsed = CreatePromoCodeWriteSchema.safeParse(parseBookingBody(init));
      if (!parsed.success) return new Response(null, { status: 400 });
      const result = createMockPromoCode(organizerPromocodes[1], parsed.data);
      return result === null ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : result === "invalid" ? new Response(null, { status: 400 }) : result === "duplicate" ? new Response(null, { status: 409 }) : Response.json(result);
    }
    if (organizerPromocodes) {
      const result = listMockPromoCodes(organizerPromocodes[1]);
      return result === null ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : Response.json(result);
    }
    const organizerEarlyAccess = /^\/api\/organizer\/events\/([^/]+)\/early-access$/.exec(url.pathname);
    if (organizerEarlyAccess && init?.method === "POST") {
      const parsed = EarlyAccessWriteSchema.safeParse(parseBookingBody(init));
      if (!parsed.success) return new Response(null, { status: 400 });
      const result = setMockEarlyAccess(organizerEarlyAccess[1], parsed.data.bookingOpensAt);
      return result === null ? new Response(null, { status: 404 }) : result === "forbidden" ? new Response(null, { status: 403 }) : Response.json(result);
    }
    if (url.pathname === "/api/assist/day" && init?.method === "POST") {
      const parsed = AssistQueryWriteSchema.safeParse(parseBookingBody(init));
      if (!parsed.success) return new Response(null, { status: 400 });
      const result = mockAssistDay(parsed.data);
      return result === "rate_limited" ? new Response(null, { status: 429 }) : result === "invalid" || result === "no_events" ? new Response(null, { status: 400 }) : Response.json(result);
    }
    if (url.pathname === "/api/assist" && init?.method === "POST") {
      const parsed = AssistQueryWriteSchema.safeParse(parseBookingBody(init));
      if (!parsed.success) return new Response(null, { status: 400 });
      const result = mockAssistSuggest(parsed.data);
      return result === "rate_limited" ? new Response(null, { status: 429 }) : result === "invalid" ? new Response(null, { status: 400 }) : Response.json(result);
    }
    return real(input, init);
  };
  return () => {
    globalThis.fetch = real;
  };
}
