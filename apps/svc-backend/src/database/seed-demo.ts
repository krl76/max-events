// START_MODULE_CONTRACT
// PURPOSE: Deterministic demo-data generator (fakerRU seed 42) plus its insertion into the local dev database.
// SCOPE: buildDemoData pure row generators with stable uuids/dates, including the viewer slice that gives the signed-in dev user a share of every personal domain; seedDemoDatabase ensures the demo owner users and inserts every table in FK order, skipping unique violations; assertLocalDatabaseUrl refuses non-local databases.
// DEPENDS: typeorm, @faker-js/faker (fakerRU), @max-events/api-contracts, ../lists LIST_PRESET_TITLES, ../achievements ACHIEVEMENT_CATALOG, ../mycity districtKey, ../payments commission, feature entities
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - DemoScale - small | normal | big scale name
// - DemoCounts - per-table row volumes for a scale
// - DEMO_COUNTS - per-scale row volumes (normal follows issue #463)
// - DemoBuildConfig - pure-generator inputs (clock, scale, owner ids)
// - DemoSeedOptions - seedDemoDatabase options
// - parseDemoScale - SEED_DEMO_SCALE value to DemoScale, default normal
// - assertLocalDatabaseUrl - throw unless the DATABASE_URL host is localhost/127.0.0.1, or allowRemote opens the door deliberately
// - ViewerSlice - rows the signed-in dev user owns or takes part in
// - ViewerSliceInput - pools the viewer slice is drawn from (clock, viewer id, people, places, events)
// - buildViewerSlice - the viewer's own plans, groups, votes, subscriptions, bookings, lists and visits
// - buildUserAchievements - grants derived from the generated check-ins, by the same catalog the API reads
// - buildDemoData - pure generation of all demo rows (deterministic ids via fakerRU.seed(42))
// - resetGeneratedContent - empty generated and user-made content tables; accounts stay
// - seedDemoDatabase - ensure owner users, sweep leftover feed, upsert demo events, insert tables in dependency order
// - sweepStaleDemoFeed - drop CAST posts/stories and leftover junk by photo or text so additive seed does not keep Anna-as-a-man rows
// - upsertDemoEvents - keep one published copy per scene title+city and refresh its clock
// - DemoData - generated rows per table
// - DemoSeedResult - inserted counters plus totals
// END_MODULE_MAP

import "reflect-metadata";
import { fakerRU } from "@faker-js/faker";
import { DEFAULT_PRIVACY, DEFAULT_SMART_ALERTS, type AchievementCode, type BookingStatus, type CityWalk, type EventCategory, type GatheringStatus, type InviteeResponse, type ListPreset, type MicroEventStatus, type ParticipationStatus, type PaymentStatus, type PlaceCategory, type PlanParticipantStatus, type PromoCampaignStatus, type PromoCampaignType, type PromotionStatus, type PromotionType, type ReportReason, type ReportSource, type ReportStatus, type ReportTargetType, type WaitlistStatus, type WeGroupStatus } from "@max-events/api-contracts";
import { In, type DataSource, type ObjectLiteral, type Repository } from "typeorm";
import { ACHIEVEMENT_CATALOG } from "../achievements/achievements.service";
import { UserAchievementEntity } from "../achievements/user-achievement.entity";
import { BookingEntity } from "../bookings/booking.entity";
import { CheckInEntity } from "../checkins/check-in.entity";
import { FeedCommentEntity, FeedLikeEntity, FeedPostEntity, FeedPostGoingEntity } from "../feed/feed-post.entity";
import { FriendshipEntity } from "../friends/friendship.entity";
import { EventEntity } from "../events/event.entity";
import { GatheringEntity } from "../gatherings/gathering.entity";
import { GatheringInviteeEntity } from "../gatherings/gathering-invitee.entity";
import { ListItemEntity } from "../lists/list-item.entity";
import { ListEntity } from "../lists/list.entity";
import { LIST_PRESET_TITLES, SHELF_PRESETS } from "../lists/lists.service";
import { MicroEventEntity, MicroEventParticipantEntity } from "../microevents/micro-event.entity";
import { districtKey } from "../mycity/my-city.service";
import { OrganizationEntity } from "../organizations/organization.entity";
import { DEFAULT_COMMISSION_BPS, splitTicketSale } from "../payments/commission";
import { PaymentEntity } from "../payments/payment.entity";
import { PlaceEntity } from "../places/place.entity";
import { PlanEntity } from "../plans/plan.entity";
import { PlanExpenseEntity } from "../plans/plan-expense.entity";
import { PlanParticipantEntity } from "../plans/plan-participant.entity";
import { ParticipationEntity } from "../participations/participation.entity";
import { PromoCampaignEntity } from "../promo/promo-campaign.entity";
import { PromoCodeEntity } from "../promo/promo-code.entity";
import { PromoFulfillmentEntity } from "../promo/promo-fulfillment.entity";
import { PromotionCampaignEntity } from "../promotion/promotion-campaign.entity";
import { ReportEntity } from "../reports/report.entity";
import { ReviewEntity } from "../reviews/review.entity";
import { StoryEntity } from "../stories/story.entity";
import { SubscriptionEntity } from "../subscriptions/subscription.entity";
import { PageViewEntity } from "../stats/page-view.entity";
import { ProfileEntity } from "../users/profile.entity";
import { UserEntity } from "../users/user.entity";
import { VoteBallotEntity, VoteEntity, VoteOptionEntity, VoteParticipantEntity } from "../votes/vote.entity";
import { WaitlistEntryEntity } from "../waitlist/waitlist-entry.entity";
import { CityWalkEntity } from "../walks/city-walk.entity";
import { WeGroupEntity, WeGroupItemEntity, WeGroupMemberEntity, WeGroupPhotoEntity } from "../wegroups/we-group.entity";
import { SwipeDecisionEntity } from "../swipe/swipe-decision.entity";
import { AUTHORED_COMMENTS, AUTHORED_POSTS, AUTHORED_REVIEWS, AUTHORED_STORIES, DEMO_CAST, ORGANIZER_REVIEW_TEXTS, ORGANIZER_SHOWCASE, PLACE_LOGOS, VIEWER_WALKS, WE_GROUP_TITLES } from "./seed-demo-cast";

// --- Demo scales and guards -------------------------------------------------

export type DemoScale = "small" | "normal" | "big";

export type DemoCounts = {
  users: number;
  places: number;
  events: number;
  stories: number;
  feedPosts: number;
  reviews: number;
  checkIns: number;
  bookings: number;
  participations: number;
  plans: number;
  votes: number;
  weGroups: number;
  gatherings: number;
  microEvents: number;
  subscriptions: number;
  pageViews: number;
  feedLikes: number;
  feedComments: number;
  waitlistEntries: number;
  reports: number;
};

export const DEMO_COUNTS: Record<DemoScale, DemoCounts> = {
  small: { users: 10, places: 32, events: 12, stories: 8, feedPosts: 8, reviews: 8, checkIns: 18, bookings: 10, participations: 20, plans: 3, votes: 2, weGroups: 1, gatherings: 1, microEvents: 4, subscriptions: 5, pageViews: 60, feedLikes: 20, feedComments: 8, waitlistEntries: 4, reports: 3 },
  normal: { users: 20, places: 32, events: 12, stories: 12, feedPosts: 12, reviews: 8, checkIns: 100, bookings: 50, participations: 100, plans: 18, votes: 8, weGroups: 5, gatherings: 6, microEvents: 18, subscriptions: 24, pageViews: 320, feedLikes: 120, feedComments: 36, waitlistEntries: 16, reports: 10 },
  big: { users: 20, places: 32, events: 12, stories: 12, feedPosts: 12, reviews: 8, checkIns: 150, bookings: 75, participations: 150, plans: 25, votes: 12, weGroups: 7, gatherings: 7, microEvents: 25, subscriptions: 40, pageViews: 500, feedLikes: 180, feedComments: 36, waitlistEntries: 25, reports: 20 },
};

export function parseDemoScale(raw: string | undefined): DemoScale {
  if (raw === undefined || raw === "") return "normal";
  if (raw === "small" || raw === "normal" || raw === "big") return raw;
  throw new Error(`SEED_DEMO_SCALE must be one of small|normal|big, got "${raw}"`);
}

/**
 * Демо-данные придуманы целиком, поэтому по умолчанию сид отказывается работать с любой базой, кроме
 * локальной: случайно налить выдумку в чужую базу — ошибка, которую нельзя отменить.
 *
 * `allowRemote` снимает запрет там, где выдумка и нужна: стенд без контура MAX, где база живёт в сети
 * docker под именем `postgres` и локальной не выглядит. Это не послабление, а второй ключ: флаг
 * приходит отдельной переменной окружения и в обычном запуске отсутствует.
 */
export function assertLocalDatabaseUrl(url: string, allowRemote = false): void {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("seed:demo requires a valid DATABASE_URL");
  }
  if (allowRemote) return;
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(`seed:demo refuses to run against non-local database host "${host}" (set SEED_DEMO_ALLOW_REMOTE=1 to override)`);
  }
}

// --- Pools (fixed, Moscow-centric) ------------------------------------------

const DEMO_CITY = "Москва";
const DEMO_USER_ID_BASE = 700_000_001;
export const DEMO_MAX_USER_PREFIX = "700000";
const HOUR_MS = 3_600_000;

const EVENT_COVER_PHOTOS = new Set([
  "/onboarding/gorky.jpg",
  "/covers/jazz.jpg",
  "/covers/concert.jpg",
  "/covers/run.jpg",
  "/covers/tour.jpg",
  "/covers/lecture.jpg",
  "/covers/yoga.jpg",
  "/covers/ceramic.jpg",
  "/covers/bike.jpg",
  "/covers/cleanup.jpg",
  "/covers/kolomenskoe.jpg",
  "/covers/graphics.jpg",
  "/covers/dawn.jpg",
  "/covers/books.jpg",
  "/covers/pingpong.jpg",
  "/covers/shelter.jpg",
  "/covers/visits/tsaritsyno.jpg",
  "/covers/visits/museum.jpg",
  "/covers/visits/run.jpg",
  "/covers/visits/cleanup.jpg",
  "/covers/visits/cafe.jpg",
]);

const JUNK_FEED_TEXTS = new Set(["Отличное мероприятие, советую всем!", "Была вчера — восторг!", "Кто идёт? Пишите в чат.", "Собираем компанию на выходные.", "Впечатлений море, обязательно повторим.", "Лучшая суббота за месяц.", "Только вернулись — до сих пор под впечатлением.", "Спасибо организаторам!", "Идём с друзьями, присоединяйтесь.", "Место легко найти, вход свободный."]);
const JUNK_FEED_TEXT_KEYS = new Set([...JUNK_FEED_TEXTS].map((text) => normalizeFeedText(text)));

export function normalizeFeedText(text: string): string {
  return text.toLowerCase().replaceAll("ё", "е").replace(/\s+/g, " ").trim();
}

export function isEventCoverPhoto(photoUrl: string | null | undefined): boolean {
  if (photoUrl == null || photoUrl === "") return false;
  if (photoUrl.startsWith("/covers/posts/")) return false;
  if (photoUrl.endsWith("-me.jpg")) return false;
  return EVENT_COVER_PHOTOS.has(photoUrl) || photoUrl.startsWith("/covers/places/");
}

const PLACE_POOL: ReadonlyArray<{ title: string; address: string; category: PlaceCategory; latitude: number; longitude: number }> = [
  { title: "Парк Горького", address: "ул. Крымский Вал, 9", category: "park", latitude: 55.7297, longitude: 37.6014 },
  { title: "Сокольники", address: "5-й Лучевой просек, 3", category: "park", latitude: 55.793, longitude: 37.6768 },
  { title: "ВДНХ", address: "пр-т Мира, 119, стр. 1", category: "park", latitude: 55.8263, longitude: 37.6377 },
  { title: "Парк «Зарядье»", address: "ул. Варварка, 6с1", category: "park", latitude: 55.752, longitude: 37.6232 },
  { title: "Коломенское", address: "пр-т Андропова, 39", category: "park", latitude: 55.6675, longitude: 37.671 },
  { title: "Царицыно", address: "ул. Дольская, 1", category: "park", latitude: 55.6156, longitude: 37.6824 },
  { title: "Кусково", address: "ул. Юности, 2", category: "park", latitude: 55.746, longitude: 37.819 },
  { title: "Аптекарский огород", address: "пр-т Мира, 26с1", category: "park", latitude: 55.7786, longitude: 37.6327 },
  { title: "Измайловский парк", address: "ул. Городская, 1", category: "park", latitude: 55.7795, longitude: 37.734 },
  { title: "Парк Победы", address: "площадь Победы, 3", category: "park", latitude: 55.7345, longitude: 37.506 },
  { title: "Нескучный сад", address: "Ленинский пр-т, 30", category: "park", latitude: 55.7143, longitude: 37.5905 },
  { title: "Третьяковская галерея", address: "Лаврушинский пер., 10", category: "museum", latitude: 55.7415, longitude: 37.6208 },
  { title: "ГМИИ им. А.С. Пушкина", address: "ул. Волхонка, 12", category: "museum", latitude: 55.7447, longitude: 37.605 },
  { title: "Музей космонавтики", address: "пр-т Мира, 111", category: "museum", latitude: 55.8225, longitude: 37.6393 },
  { title: "Дарвиновский музей", address: "ул. Вавилова, 57", category: "museum", latitude: 55.6912, longitude: 37.576 },
  { title: "Музей «Гараж»", address: "ул. Крымский Вал, 9с32", category: "museum", latitude: 55.7285, longitude: 37.6013 },
  { title: "Кофейня «Даблби»", address: "ул. Мясницкая, 24", category: "food", latitude: 55.7645, longitude: 37.6353 },
  { title: "Пекарня «Батон»", address: "ул. Покровка, 4", category: "food", latitude: 55.7592, longitude: 37.644 },
  { title: "Кофейня «Сёрф»", address: "Никитский бульвар, 12", category: "food", latitude: 55.756, longitude: 37.608 },
  { title: "Антикафе «Циферблат»", address: "ул. Маросейка, 9с1", category: "food", latitude: 55.7565, longitude: 37.637 },
  { title: "Лужники", address: "ул. Лужники, 24с1", category: "sport", latitude: 55.7158, longitude: 37.5536 },
  { title: "СК «Олимпийский»", address: "Олимпийский пр-т, 16", category: "sport", latitude: 55.7835, longitude: 37.54 },
  { title: "ВТБ Арена", address: "Ходынский б-р, 3", category: "sport", latitude: 55.7886, longitude: 37.4402 },
  { title: "УСЗ «Москвич»", address: "ул. Люблинская, 100с1", category: "sport", latitude: 55.6575, longitude: 37.744 },
  { title: "ДК «Москва»", address: "ул. Ленинская Слобода, 26", category: "other", latitude: 55.7083, longitude: 37.664 },
  { title: "Кинотеатр «Иллюзион»", address: "Котельническая наб., 1/15", category: "other", latitude: 55.747, longitude: 37.641 },
  { title: "Патриаршие пруды", address: "ул. Малая Бронная, 32", category: "park", latitude: 55.7639, longitude: 37.5924 },
  { title: "Чистые пруды", address: "Чистопрудный бульвар, 12", category: "park", latitude: 55.7608, longitude: 37.646 },
  { title: "Воробьёвы горы", address: "ул. Косыгина, 28", category: "park", latitude: 55.7102, longitude: 37.5594 },
  { title: "Музеон", address: "ул. Крымский Вал, 2", category: "park", latitude: 55.7344, longitude: 37.6056 },
  { title: "Новодевичий монастырь", address: "Новодевичий пр., 1", category: "museum", latitude: 55.7262, longitude: 37.5595 },
  { title: "Сад «Эрмитаж»", address: "ул. Каретный Ряд, 3", category: "park", latitude: 55.7708, longitude: 37.6094 },
];

/** Одно событие — одна площадка и два снимка: афиша места и кадр, где человек сам в кадре. */
const SCENES: ReadonlyArray<{
  title: string;
  category: EventCategory;
  place: string;
  description: string;
  cover: string;
  visit: string;
  post: string;
  review: string;
  paid: boolean;
  price: number | null;
  past: boolean;
  dayOffset: number;
  hourUtc: number;
}> = [
  { title: "Утренняя йога у арки", category: "sport", place: "Парк Горького", description: "Встречаемся у главной арки Парка Горького за десять минут до старта. Коврики свои, занятие на лужайке сразу за воротами.", cover: "/onboarding/gorky.jpg", visit: "/covers/visits/gorky-me.jpg", post: "Утренняя йога у арки Парка Горького. Собрались на лужайке сразу за воротами.", review: "В Парке Горького удобно: арка видна сразу, на лужайке хватило места всем коврикам.", paid: false, price: null, past: true, dayOffset: -3, hourUtc: 7 },
  { title: "Экскурсия по Царицыну", category: "tourism", place: "Царицыно", description: "Сбор у Большого дворца Царицына, со стороны пруда. Полтора часа по парку, без спешки и без билета в сам дворец.", cover: "/covers/visits/tsaritsyno.jpg", visit: "/covers/visits/tsaritsyno-me.jpg", post: "Экскурсия по Царицыну. Гуляли у пруда, Большой дворец напротив.", review: "В Царицыне гид держал группу у пруда, дворец всё время был в кадре. Никуда не бежали.", paid: false, price: null, past: true, dayOffset: -5, hourUtc: 11 },
  { title: "Джаз в Нескучном саду", category: "afisha", place: "Нескучный сад", description: "Трио играет у летней площадки Нескучного сада. Вход свободный, стулья занимают кто пришёл раньше.", cover: "/covers/jazz.jpg", visit: "/covers/jazz.jpg", post: "Джаз в Нескучном саду. Трио играло у столиков, без сцены.", review: "В Нескучном саду трио было близко, без сцены и без опоздания. Час пролетел незаметно.", paid: false, price: null, past: true, dayOffset: -2, hourUtc: 16 },
  { title: "Авторская песня в «Циферблате»", category: "afisha", place: "Антикафе «Циферблат»", description: "Гитара и несколько песен в зале антикафе «Циферблат» на Маросейке. Чай берём на месте.", cover: "/covers/concert.jpg", visit: "/covers/concert.jpg", post: "Авторская песня в «Циферблате». Гитара на столе, зал маленький и тихий.", review: "В «Циферблате» слышно каждое слово, зал маленький. Начало ровно в заявленное время.", paid: true, price: 400, past: true, dayOffset: -4, hourUtc: 16 },
  { title: "Лекция в Третьяковке", category: "afisha", place: "Третьяковская галерея", description: "Час в залах Третьяковской галереи на Лаврушинском: как смотреть на большое полотно, не пробегая мимо.", cover: "/covers/visits/museum.jpg", visit: "/covers/visits/museum.jpg", post: "После лекции остались в зале Третьяковки у большого полотна.", review: "В Третьяковке группа была небольшой, у картины удалось постоять, а не только пройти мимо.", paid: true, price: 700, past: true, dayOffset: -6, hourUtc: 14 },
  { title: "Пять километров в Сокольниках", category: "sport", place: "Сокольники", description: "Лёгкий темп по главной аллее Сокольников. Сбор у входа со стороны 5-го Лучевого просека.", cover: "/covers/visits/run.jpg", visit: "/covers/visits/run.jpg", post: "Пять километров в Сокольниках. На главной аллее ещё не отдышался.", review: "В Сокольниках трасса ровная, темп и правда лёгкий. Воду лучше взять с собой.", paid: false, price: null, past: true, dayOffset: -1, hourUtc: 8 },
  { title: "Субботник в Измайловском парке", category: "volunteering", place: "Измайловский парк", description: "Час вдоль дорожек Измайловского парка. Перчатки выдадут на месте, мешки тоже.", cover: "/covers/visits/cleanup.jpg", visit: "/covers/visits/cleanup.jpg", post: "Субботник в Измайловском парке. Мешок собрали вдвоём за час.", review: "В Измайловском парке всё организовали просто: перчатки, мешок, час работы и чай.", paid: false, price: null, past: true, dayOffset: -7, hourUtc: 8 },
  { title: "Разговорный клуб в «Даблби»", category: "afisha", place: "Кофейня «Даблби»", description: "Час английского за столом у окна в «Даблби» на Мясницкой. Напиток каждый берёт сам.", cover: "/covers/visits/cafe.jpg", visit: "/covers/visits/cafe.jpg", post: "Разговорный клуб в «Даблби» на Мясницкой. После занятия остались за кофе у окна.", review: "В «Даблби» на Мясницкой было тихо достаточно, чтобы слышать друг друга. Стол у окна — удача.", paid: false, price: null, past: true, dayOffset: -3, hourUtc: 16 },
  { title: "Экскурсия по Коломенскому", category: "tourism", place: "Коломенское", description: "Сбор у деревянного дворца в Коломенском. Идём к церкви, без захода в платные палаты.", cover: "/covers/kolomenskoe.jpg", visit: "/covers/kolomenskoe.jpg", post: "В Коломенском дошли по дорожке до деревянного дворца и церкви.", review: "В Коломенском маршрут короткий и понятный: дворец, дорожка, церковь. Обувь удобная пригодилась.", paid: false, price: null, past: false, dayOffset: 3, hourUtc: 10 },
  { title: "Прогулка по дворам Замоскворечья", category: "tourism", place: "Третьяковская галерея", description: "Выходим от Третьяковской галереи и час ходим по ближайшим дворам. Это не залы музея, билет не нужен.", cover: "/covers/tour.jpg", visit: "/covers/tour.jpg", post: "Ушли от Третьяковки во дворы Замоскворечья. Жёлтый дом с зелёной аркой.", review: "Маршрут от Третьяковки по дворам спокойный, без толпы. Зелёная арка и правда на месте.", paid: false, price: null, past: false, dayOffset: 5, hourUtc: 12 },
  { title: "Субботник у арки Парка Горького", category: "volunteering", place: "Парк Горького", description: "Собираемся у главной арки Парка Горького. Час на площади перед входом, мешки выдают.", cover: "/onboarding/gorky.jpg", visit: "/covers/visits/gorky-me.jpg", post: "Субботник у арки Парка Горького. Час на площади перед входом.", review: "У арки Парка Горького легко найти группу. Час прошёл быстро, площадь стала заметно чище.", paid: false, price: null, past: false, dayOffset: 2, hourUtc: 8 },
  { title: "Камерный вечер в ДК «Москва»", category: "afisha", place: "ДК «Москва»", description: "Небольшой зал ДК «Москва» на Ленинской Слободе. Гитара и два отделения, без танцпола.", cover: "/covers/concert.jpg", visit: "/covers/concert.jpg", post: "Камерный вечер в ДК «Москва». Сидели близко, гитара была на расстоянии вытянутой руки.", review: "В ДК «Москва» зал маленький, слышно без микрофона на весь крик. Места лучше занять заранее.", paid: true, price: 900, past: false, dayOffset: 8, hourUtc: 17 },
];

function sceneByTitle(title: string): (typeof SCENES)[number] {
  const scene = SCENES.find((item) => item.title === title);
  if (!scene) throw new Error(`Нет сцены для события «${title}»`);
  return scene;
}

const MEETING_POINTS = ["У входа в метро «Парк культуры»", "У центрального фонтана", "У билетных касс", "У главного входа в парк", "У фудкорта", "У сцены"];

const INTEREST_POOL = ["Спорт", "Музыка", "Искусство", "Гастрономия", "Путешествия", "Настольные игры", "Волонтёрство", "Театр", "Кино", "Фотография", "Бег", "Лекции"];

const VOTE_TITLES = ["Куда идём в субботу?", "Выбираем событие на выходные", "Голосуем за план на вечер", "Что делаем в пятницу?", "Куда сходить большой компанией?"];



const EXPENSE_TITLES = ["Билеты", "Ужин после события", "Транспорт", "Аренда инвентаря"];

const PLAN_PARTICIPANT_STATUSES = ["invited", "confirmed", "declined"] as const satisfies readonly PlanParticipantStatus[];
const INVITEE_RESPONSES = ["accepted", "considering", "busy"] as const satisfies readonly InviteeResponse[];
const PROMOTION_TYPES = ["boost", "banner", "pin"] as const satisfies readonly PromotionType[];

const COMMENT_TEXTS = ["Тоже там были, отличный вечер.", "А во сколько собираетесь?", "Присоединюсь в следующий раз.", "Спасибо, забрал в свой список.", "Место и правда хорошее.", "Мы рядом живём, дойдём пешком."];

const REPORT_REASONS = ["spam", "abuse", "inaccurate", "inappropriate", "other"] as const satisfies readonly ReportReason[];
const REPORT_TARGET_TYPES = ["event", "place", "feed_post", "micro_event"] as const satisfies readonly ReportTargetType[];

// Зритель — человек, который реально входит на стенд. Его строки названы отдельно, чтобы экраны
// «про меня» читались как чей-то живой аккаунт, а не как чужая витрина.
const VIEWER_CUSTOM_LIST_TITLE = "Мой маршрут на осень";
const VIEWER_WE_GROUP_TITLES = ["Мы: субботние вылазки", "Мы: музейный клуб", "Мы: летние поездки"] as const;

// --- Pure generation ---------------------------------------------------------

export type DemoBuildConfig = { now: Date; scale: DemoScale; ownerUserId: string; devUserId: string; /** When false, no lists/friends/tickets are attached to the signed-in MAX account. */ personal?: boolean };

export type DemoData = {
  users: UserEntity[];
  profiles: ProfileEntity[];
  friendships: FriendshipEntity[];
  places: PlaceEntity[];
  events: EventEntity[];
  promoCodes: PromoCodeEntity[];
  promoCampaigns: PromoCampaignEntity[];
  promotionCampaigns: PromotionCampaignEntity[];
  participations: ParticipationEntity[];
  bookings: BookingEntity[];
  checkIns: CheckInEntity[];
  stories: StoryEntity[];
  feedPosts: FeedPostEntity[];
  reviews: ReviewEntity[];
  subscriptions: SubscriptionEntity[];
  pageViews: PageViewEntity[];
  lists: ListEntity[];
  listItems: ListItemEntity[];
  votes: VoteEntity[];
  voteOptions: VoteOptionEntity[];
  voteParticipants: VoteParticipantEntity[];
  voteBallots: VoteBallotEntity[];
  weGroups: WeGroupEntity[];
  weGroupMembers: WeGroupMemberEntity[];
  weGroupItems: WeGroupItemEntity[];
  gatherings: GatheringEntity[];
  gatheringInvitees: GatheringInviteeEntity[];
  microEvents: MicroEventEntity[];
  microEventParticipants: MicroEventParticipantEntity[];
  plans: PlanEntity[];
  planParticipants: PlanParticipantEntity[];
  planExpenses: PlanExpenseEntity[];
  feedLikes: FeedLikeEntity[];
  feedComments: FeedCommentEntity[];
  waitlistEntries: WaitlistEntryEntity[];
  userAchievements: UserAchievementEntity[];
  reports: ReportEntity[];
  payments: PaymentEntity[];
  promoFulfillments: PromoFulfillmentEntity[];
  cityWalks: CityWalkEntity[];
  weGroupPhotos: WeGroupPhotoEntity[];
  swipeDecisions: SwipeDecisionEntity[];
};

function uuid(): string {
  return fakerRU.string.uuid();
}

function pick<T>(pool: readonly T[]): T {
  return pool[fakerRU.number.int({ min: 0, max: pool.length - 1 })]!;
}

function int(min: number, max: number): number {
  return fakerRU.number.int({ min, max });
}

function chance(likelihood: number): boolean {
  return fakerRU.datatype.boolean(likelihood);
}

function shiftDays(base: Date, days: number, hourUtc: number): Date {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + days, hourUtc, int(0, 45)));
}

function eventStart(now: Date, dayOffset: number, hourUtc: number): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset, hourUtc, 0, 0, 0));
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Возвращает элементы пула по кругу: соседние вызовы дают разные строки, пока пул не кончится. */
function rotator<T>(pool: readonly T[]): () => T {
  let cursor = 0;
  return () => pool[cursor++ % pool.length]!;
}

/**
 * Сценарий зрителя опирается на срезы событий — платные, прошедшие, с площадкой. На маленьком
 * масштабе срез может оказаться пустым, и тогда лучше взять событие «не того» вида, чем оставить
 * экран без строки вовсе.
 */
function nonEmpty<T>(subset: readonly T[], fallback: readonly T[]): readonly T[] {
  return subset.length > 0 ? subset : fallback;
}

function takeDistinct<T extends { id: string }>(next: () => T, count: number): T[] {
  const picked: T[] = [];
  const seen = new Set<string>();
  for (let attempt = 0; attempt < count * 4 && picked.length < count; attempt += 1) {
    const row = next();
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    picked.push(row);
  }
  return picked;
}

// --- Viewer slice ------------------------------------------------------------

/**
 * Строки, которыми владеет или в которых участвует зритель — человек, реально вошедший на стенд.
 * Без них личные экраны показывают пустоту: данные в базе есть, но все они чужие.
 */
export type ViewerSlice = {
  lists: ListEntity[];
  listItems: ListItemEntity[];
  plans: PlanEntity[];
  planParticipants: PlanParticipantEntity[];
  planExpenses: PlanExpenseEntity[];
  votes: VoteEntity[];
  voteOptions: VoteOptionEntity[];
  voteParticipants: VoteParticipantEntity[];
  voteBallots: VoteBallotEntity[];
  weGroups: WeGroupEntity[];
  weGroupMembers: WeGroupMemberEntity[];
  weGroupItems: WeGroupItemEntity[];
  gatherings: GatheringEntity[];
  gatheringInvitees: GatheringInviteeEntity[];
  microEvents: MicroEventEntity[];
  microEventParticipants: MicroEventParticipantEntity[];
  subscriptions: SubscriptionEntity[];
  bookings: BookingEntity[];
  checkIns: CheckInEntity[];
  reviews: ReviewEntity[];
  participations: ParticipationEntity[];
  feedPosts: FeedPostEntity[];
};

export type ViewerSliceInput = {
  now: Date;
  viewerId: string;
  users: UserEntity[];
  organizers: UserEntity[];
  places: PlaceEntity[];
  pastEvents: EventEntity[];
  futureEvents: EventEntity[];
};

export function buildViewerSlice(input: ViewerSliceInput): ViewerSlice {
  const { now, viewerId, users, organizers, places, pastEvents, futureEvents } = input;
  // Друзья зрителя — ровно те, с кем его свели дружбы выше: каждый третий из сгенерированных.
  const friends = nonEmpty(
    users.filter((_, i) => i % 3 === 0),
    users,
  );
  const friend = (index: number): UserEntity => friends[index % friends.length]!;
  const nextFuture = rotator(nonEmpty(futureEvents, pastEvents));
  const nextPast = rotator(nonEmpty(pastEvents, futureEvents));
  const nextFuturePaid = rotator(
    nonEmpty(
      futureEvents.filter((event) => event.isPaid && event.priceRub !== null),
      futureEvents,
    ),
  );
  const nextFutureWithPlace = rotator(
    nonEmpty(
      futureEvents.filter((event) => event.placeId !== null),
      futureEvents,
    ),
  );
  const nextPastWithPlace = rotator(
    nonEmpty(
      pastEvents.filter((event) => event.placeId !== null),
      nonEmpty(pastEvents, futureEvents),
    ),
  );

  // События, на которых сходится весь сценарий: план зрителя, его группа, бронь и отзыв смотрят на
  // одни и те же строки, иначе бюджет группы пуст, а галерея — без фото.
  const hostedPlanEvent = nextFutureWithPlace();
  const invitedPlanEvent = nextFutureWithPlace();
  const groupPastEvent = nextPastWithPlace();
  const bookedEvents = new Set<string>();
  const takeBookingEvent = (next: () => EventEntity): EventEntity => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const event = next();
      if (bookedEvents.has(event.id)) continue;
      bookedEvents.add(event.id);
      return event;
    }
    const fallback = next();
    bookedEvents.add(fallback.id);
    return fallback;
  };
  const paidBookingEvent = takeBookingEvent(nextFuturePaid);
  const pastBookingEvent = takeBookingEvent(nextPast);
  const cancelledBookingEvent = takeBookingEvent(nextFuture);

  // Списки (37, 39): шесть пресетов с содержимым и один собственный список.
  const lists: ListEntity[] = SHELF_PRESETS.map((preset: ListPreset) => ({ id: uuid(), userId: viewerId, preset, title: LIST_PRESET_TITLES[preset], visibility: "private", createdAt: shiftDays(now, -int(14, 40), 12), updatedAt: shiftDays(now, -int(1, 9), 12) }));
  lists.push({ id: uuid(), userId: viewerId, preset: null, title: VIEWER_CUSTOM_LIST_TITLE, visibility: "private", createdAt: shiftDays(now, -12, 12), updatedAt: shiftDays(now, -2, 12) });
  const listItems: ListItemEntity[] = [];
  const listTargets = new Set<string>();
  for (const list of lists) {
    for (let k = 0; k < 3; k += 1) {
      const useEvent = k < 2;
      const targetId = useEvent ? nextFuture().id : pick(places).id;
      const key = `${list.id}:${targetId}`;
      if (listTargets.has(key)) continue;
      listTargets.add(key);
      listItems.push({ id: uuid(), listId: list.id, eventId: useEvent ? targetId : null, placeId: useEvent ? null : targetId, feedPostId: null, addedAt: shiftDays(now, -int(1, 18), 12) });
    }
  }

  // Планы (15, 22): один свой и один, куда зрителя позвали; в обоих участники и расходы.
  const plans: PlanEntity[] = [];
  const planParticipants: PlanParticipantEntity[] = [];
  const planExpenses: PlanExpenseEntity[] = [];
  const addPlan = (hostUserId: string, event: EventEntity, invited: Array<{ userId: string; status: PlanParticipantStatus }>, meetingPoint: string, expenseCount: number): void => {
    const planId = uuid();
    const createdAt = shiftDays(now, -int(2, 6), 11);
    const seen = new Set<string>([hostUserId]);
    const guests: Array<{ userId: string; status: PlanParticipantStatus }> = [];
    for (const guest of invited) {
      if (seen.has(guest.userId)) continue;
      seen.add(guest.userId);
      guests.push(guest);
    }
    plans.push({ id: planId, hostUserId, eventId: event.id, meetingPoint, meetingAt: new Date(event.startsAt.getTime() - 90 * 60_000), chatLink: null, reminderSentAt: null, leaveNowSentAt: null, weatherAlertSentAt: null, friendLeftBroadcastAt: null, recurringRule: null, seriesId: null, sourcePlanId: null, cancelledAt: null, assembledByMax: false, createdAt, updatedAt: createdAt });
    for (const guest of guests) {
      planParticipants.push({ id: uuid(), planId, userId: guest.userId, status: guest.status, reminderSentAt: null, leaveNowSentAt: null, friendLeftBroadcastAt: null, pollSentAt: null, createdAt, updatedAt: createdAt });
    }
    for (let k = 0; k < expenseCount; k += 1) {
      planExpenses.push({ id: uuid(), planId, title: EXPENSE_TITLES[k % EXPENSE_TITLES.length]!, amountRub: int(6, 40) * 50, payerUserId: hostUserId, shareUserIds: [hostUserId, ...guests.map((guest) => guest.userId)], createdAt });
    }
  };
  addPlan(
    viewerId,
    hostedPlanEvent,
    [0, 1, 2].map((i) => ({ userId: friend(i).id, status: PLAN_PARTICIPANT_STATUSES[i % PLAN_PARTICIPANT_STATUSES.length]! })),
    MEETING_POINTS[0]!,
    2,
  );
  addPlan(
    friend(0).id,
    invitedPlanEvent,
    [
      { userId: viewerId, status: "confirmed" as PlanParticipantStatus },
      { userId: friend(1).id, status: "confirmed" as PlanParticipantStatus },
      { userId: friend(2).id, status: "invited" as PlanParticipantStatus },
    ],
    MEETING_POINTS[1]!,
    2,
  );

  // Голосования (32, 33): одно открытое, где зритель ещё не голосовал, и одно завершённое с победителем.
  const votes: VoteEntity[] = [];
  const voteOptions: VoteOptionEntity[] = [];
  const voteParticipants: VoteParticipantEntity[] = [];
  const voteBallots: VoteBallotEntity[] = [];
  const addVote = (hostUserId: string, title: string, participantIds: string[], ballots: Array<{ userId: string; optionIndex: number }>, createdDaysAgo: number): void => {
    const voteId = uuid();
    const createdAt = shiftDays(now, -createdDaysAgo, int(10, 20));
    votes.push({ id: voteId, hostUserId, title, chatLink: null, status: "open", winnerEventId: null, createdAt, updatedAt: createdAt });
    const options = takeDistinct(nextFuture, 3);
    for (const userId of new Set(participantIds)) voteParticipants.push({ id: uuid(), voteId, userId });
    options.forEach((event, position) => voteOptions.push({ id: uuid(), voteId, eventId: event.id, position }));
    const cast = new Set<string>();
    for (const ballot of ballots) {
      if (cast.has(ballot.userId)) continue;
      cast.add(ballot.userId);
      voteBallots.push({ id: uuid(), voteId, userId: ballot.userId, eventId: options[ballot.optionIndex % options.length]!.id });
    }
  };
  // Открытое: ведёт друг, двое уже выбрали, бюллетеня зрителя нет — экран предлагает выбор, а не итог.
  addVote(
    friend(0).id,
    VOTE_TITLES[0]!,
    [viewerId, friend(1).id, friend(2).id, friend(3).id],
    [
      { userId: friend(1).id, optionIndex: 0 },
      { userId: friend(2).id, optionIndex: 1 },
    ],
    2,
  );
  // Завершённое: проголосовали все, включая зрителя, и вторая строка собрала большинство.
  addVote(
    viewerId,
    VOTE_TITLES[1]!,
    [friend(0).id, friend(1).id, friend(2).id, friend(3).id],
    [
      { userId: viewerId, optionIndex: 1 },
      { userId: friend(0).id, optionIndex: 1 },
      { userId: friend(1).id, optionIndex: 1 },
      { userId: friend(2).id, optionIndex: 0 },
      { userId: friend(3).id, optionIndex: 2 },
    ],
    9,
  );

  // Группы «Мы» (30, 31): две живые и одна в архиве; в своей — события, места, бюджет и фото.
  const weGroups: WeGroupEntity[] = [];
  const weGroupMembers: WeGroupMemberEntity[] = [];
  const weGroupItems: WeGroupItemEntity[] = [];
  const addWeGroup = (ownerUserId: string, title: string, status: WeGroupStatus, memberIds: string[], eventIds: string[], placeIds: string[], createdDaysAgo: number): void => {
    const groupId = uuid();
    const createdAt = shiftDays(now, -createdDaysAgo, 12);
    weGroups.push({ id: groupId, ownerUserId, title, chatLink: null, status, createdAt, updatedAt: createdAt, archivedAt: status === "archived" ? shiftDays(now, -int(2, 8), 12) : null });
    for (const userId of new Set(memberIds)) weGroupMembers.push({ id: uuid(), groupId, userId });
    for (const eventId of new Set(eventIds)) weGroupItems.push({ id: uuid(), groupId, eventId, placeId: null });
    for (const placeId of new Set(placeIds)) weGroupItems.push({ id: uuid(), groupId, eventId: null, placeId });
  };
  const groupMemberIds = [viewerId, friend(0).id, friend(1).id, friend(2).id, friend(3).id];
  addWeGroup(
    viewerId,
    VIEWER_WE_GROUP_TITLES[0],
    "active",
    groupMemberIds,
    [hostedPlanEvent.id, groupPastEvent.id, paidBookingEvent.id],
    takeDistinct(() => pick(places), 2).map((place) => place.id),
    24,
  );
  addWeGroup(
    friend(0).id,
    VIEWER_WE_GROUP_TITLES[1],
    "active",
    [friend(0).id, viewerId, friend(1).id],
    takeDistinct(nextFutureWithPlace, 2).map((event) => event.id),
    [pick(places).id],
    16,
  );
  addWeGroup(
    friend(1).id,
    VIEWER_WE_GROUP_TITLES[2],
    "archived",
    [friend(1).id, viewerId, friend(2).id],
    takeDistinct(nextPast, 2).map((event) => event.id),
    [pick(places).id],
    90,
  );

  // Сборы компании (23): один зритель собрал сам, во второй его позвали.
  const gatherings: GatheringEntity[] = [];
  const gatheringInvitees: GatheringInviteeEntity[] = [];
  const addGathering = (hostUserId: string, event: EventEntity, status: GatheringStatus, invitees: Array<{ userId: string; response: InviteeResponse }>): void => {
    const gatheringId = uuid();
    const createdAt = shiftDays(now, -int(1, 4), int(10, 20));
    gatherings.push({ id: gatheringId, hostUserId, eventId: event.id, proposedMeetingAt: new Date(event.startsAt.getTime() - HOUR_MS), status, chatLink: null, createdAt, updatedAt: createdAt });
    const seen = new Set<string>([hostUserId]);
    for (const invitee of invitees) {
      if (seen.has(invitee.userId)) continue;
      seen.add(invitee.userId);
      gatheringInvitees.push({ id: uuid(), gatheringId, userId: invitee.userId, response: invitee.response, respondedAt: invitee.response === "busy" ? null : shiftDays(now, -int(0, 2), 12), reminderSentAt: null, createdAt, updatedAt: createdAt });
    }
  };
  addGathering(viewerId, nextFuture(), "awaiting_responses", [
    { userId: friend(0).id, response: "accepted" },
    { userId: friend(1).id, response: "considering" },
    { userId: friend(2).id, response: "busy" },
  ]);
  addGathering(friend(3).id, nextFuture(), "confirmed", [
    { userId: viewerId, response: "considering" },
    { userId: friend(0).id, response: "accepted" },
  ]);

  // Микро-события (24, 25): одно своё и одно, куда зритель записался.
  const microEvents: MicroEventEntity[] = [];
  const microEventParticipants: MicroEventParticipantEntity[] = [];
  const ownedMicroId = uuid();
  microEvents.push({ id: ownedMicroId, authorId: viewerId, title: "Забег по аллее Сокольников", startsAt: shiftDays(now, int(2, 9), 9), locationText: null, placeId: places.find((item) => item.title === "Сокольники")?.id ?? null, description: "", listed: true, participantsLimit: int(4, 10), status: "open" as MicroEventStatus, published: true, createdAt: shiftDays(now, -3, 12) });
  microEventParticipants.push({ id: uuid(), microEventId: ownedMicroId, userId: friend(0).id }, { id: uuid(), microEventId: ownedMicroId, userId: friend(1).id });
  const joinedMicroId = uuid();
  microEvents.push({ id: joinedMicroId, authorId: friend(2).id, title: "Час в залах Третьяковки", startsAt: shiftDays(now, int(3, 12), 15), locationText: null, placeId: places.find((item) => item.title === "Третьяковская галерея")?.id ?? null, description: "", listed: true, participantsLimit: int(4, 10), status: "open" as MicroEventStatus, published: true, createdAt: shiftDays(now, -5, 12) });
  microEventParticipants.push({ id: uuid(), microEventId: joinedMicroId, userId: viewerId }, { id: uuid(), microEventId: joinedMicroId, userId: friend(3).id });

  // Подписки (41): организаторы, места и интересы — все три вида, которые различает домен.
  const subscriptions: SubscriptionEntity[] = [];
  const subscribedPlaces = takeDistinct(() => pick(places), 2);
  const subscribedInterests = fakerRU.helpers.arrayElements(INTEREST_POOL, 2);
  organizers.forEach((organizer) => subscriptions.push({ id: uuid(), userId: viewerId, type: "organizer", organizerUserId: organizer.id, placeId: null, interest: null, targetUserId: null, createdAt: shiftDays(now, -int(5, 25), 12) }));
  subscribedPlaces.forEach((place) => subscriptions.push({ id: uuid(), userId: viewerId, type: "place", organizerUserId: null, placeId: place.id, interest: null, targetUserId: null, createdAt: shiftDays(now, -int(5, 25), 12) }));
  subscribedInterests.forEach((interest) => subscriptions.push({ id: uuid(), userId: viewerId, type: "interest", organizerUserId: null, placeId: null, interest, targetUserId: null, createdAt: shiftDays(now, -int(5, 25), 12) }));

  // Брони (18, 20): активный билет на будущее платное событие, прошедшая бронь и отменённая.
  const bookings: BookingEntity[] = [
    { id: uuid(), userId: viewerId, eventId: paidBookingEvent.id, status: "active" as BookingStatus, promoCode: null, createdAt: shiftDays(now, -3, 11), updatedAt: shiftDays(now, -3, 11), reminderSentAt: null },
    { id: uuid(), userId: viewerId, eventId: pastBookingEvent.id, status: "active" as BookingStatus, promoCode: null, createdAt: new Date(pastBookingEvent.startsAt.getTime() - 3 * 24 * HOUR_MS), updatedAt: new Date(pastBookingEvent.startsAt.getTime() - 3 * 24 * HOUR_MS), reminderSentAt: null },
    { id: uuid(), userId: viewerId, eventId: cancelledBookingEvent.id, status: "cancelled" as BookingStatus, promoCode: null, createdAt: shiftDays(now, -6, 15), updatedAt: shiftDays(now, -5, 15), reminderSentAt: null },
  ];

  // Визиты и отзывы (35, 38): десять мест закрывают «Исследователя города» и «Город за выходные»,
  // три концерта оставляют «Музыкального фаната» на полпути — экран рисует и порог, и прогресс.
  const checkIns: CheckInEntity[] = [];
  places.slice(0, Math.min(11, places.length)).forEach((place, i) => {
    const checkedInAt = shiftDays(now, -(i + 1), 13);
    checkIns.push({ id: uuid(), userId: viewerId, eventId: null, placeId: place.id, visitDate: isoDay(checkedInAt), checkedInAt });
  });
  const afishaVisits = pastEvents.filter((event) => event.category === "afisha").slice(0, 3);
  const volunteeringVisits = pastEvents.filter((event) => event.category === "volunteering").slice(0, 1);
  const visitedEvents = [...new Set([groupPastEvent, ...afishaVisits, ...volunteeringVisits, pastBookingEvent])];
  visitedEvents.forEach((event) => checkIns.push({ id: uuid(), userId: viewerId, eventId: event.id, placeId: null, visitDate: null, checkedInAt: new Date(event.startsAt.getTime() + 30 * 60_000) }));

  const reviews: ReviewEntity[] = [];
  [groupPastEvent, ...afishaVisits.slice(0, 2)].forEach((event) => {
    if (reviews.some((row) => row.eventId === event.id)) return;
    const scene = sceneByTitle(event.title);
    reviews.push({ id: uuid(), userId: viewerId, eventId: event.id, stars: int(4, 5), categoryScores: { atmosphere: int(4, 5), organization: int(3, 5), price: int(3, 5), place: int(4, 5) }, wouldGoAgain: true, photoUrls: [scene.cover], factTags: [], text: scene.review, createdAt: new Date(event.startsAt.getTime() + int(2, 30) * HOUR_MS) });
  });

  const participations: ParticipationEntity[] = [];
  const participationTargets: Array<[EventEntity, ParticipationStatus]> = [
    [hostedPlanEvent, "going"],
    [invitedPlanEvent, "going"],
    [paidBookingEvent, "going"],
    [nextFuture(), "wants_to_go"],
    [nextFuture(), "looking_for_company"],
  ];
  for (const [event, status] of participationTargets) {
    if (participations.some((row) => row.eventId === event.id)) continue;
    const createdAt = shiftDays(now, -int(1, 10), int(10, 21));
    participations.push({ id: uuid(), userId: viewerId, eventId: event.id, status, createdAt, updatedAt: createdAt });
  }

  const feedPosts: FeedPostEntity[] = [];

  return { lists, listItems, plans, planParticipants, planExpenses, votes, voteOptions, voteParticipants, voteBallots, weGroups, weGroupMembers, weGroupItems, gatherings, gatheringInvitees, microEvents, microEventParticipants, subscriptions, bookings, checkIns, reviews, participations, feedPosts };
}

/**
 * Достижения (38) не выдаются наугад: их считают по тем же визитам и тому же каталогу, что и API,
 * — иначе на экране появится значок, под которым нет ни одного визита.
 */
export function buildUserAchievements(checkIns: CheckInEntity[], events: EventEntity[], places: PlaceEntity[], now: Date): UserAchievementEntity[] {
  const eventById = new Map(events.map((event) => [event.id, event]));
  const placeById = new Map(places.map((place) => [place.id, place]));
  const perUser = new Map<string, { places: Set<string>; byCategory: Map<EventCategory, number>; lastVisitAt: Date }>();
  for (const row of [...checkIns].sort((a, b) => a.checkedInAt.getTime() - b.checkedInAt.getTime() || a.id.localeCompare(b.id))) {
    const stats = perUser.get(row.userId) ?? { places: new Set<string>(), byCategory: new Map<EventCategory, number>(), lastVisitAt: row.checkedInAt };
    if (row.placeId !== null) stats.places.add(row.placeId);
    if (row.eventId !== null) {
      const event = eventById.get(row.eventId);
      if (event) {
        if (event.placeId !== null) stats.places.add(event.placeId);
        stats.byCategory.set(event.category, (stats.byCategory.get(event.category) ?? 0) + 1);
      }
    }
    stats.lastVisitAt = row.checkedInAt;
    perUser.set(row.userId, stats);
  }
  const grants: UserAchievementEntity[] = [];
  for (const [userId, stats] of [...perUser.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const districts = new Set([...stats.places].flatMap((placeId) => (placeById.has(placeId) ? [districtKey(placeById.get(placeId)!.latitude, placeById.get(placeId)!.longitude)] : [])));
    for (const item of ACHIEVEMENT_CATALOG) {
      const value = item.metric === "places" ? stats.places.size : item.metric === "districts" ? districts.size : (stats.byCategory.get(item.metric) ?? 0);
      if (value < item.threshold) continue;
      grants.push({ id: uuid(), userId, code: item.code as AchievementCode, grantedAt: new Date(Math.min(now.getTime(), stats.lastVisitAt.getTime() + HOUR_MS)) });
    }
  }
  return grants;
}

export function buildDemoData(config: DemoBuildConfig): DemoData {
  fakerRU.seed(42);
  const { now, ownerUserId, devUserId } = config;
  const personal = config.personal !== false;
  const c = DEMO_COUNTS[config.scale];

  // users + profiles: named people with matching sex, voice and avatar.
  const cast = DEMO_CAST.slice(0, c.users);
  const users: UserEntity[] = cast.map((person, i) => {
    const createdAt = shiftDays(now, -int(30, 120), int(9, 22));
    return {
      id: uuid(),
      maxUserId: String(DEMO_USER_ID_BASE + i),
      firstName: person.firstName,
      lastName: person.lastName,
      username: person.username,
      avatarUrl: person.avatarUrl,
      avatarCustom: false,
      bannedFromPublishing: false,
      friendsSyncedAt: null,
      createdAt,
      updatedAt: createdAt,
    };
  });
  const userBySlug = new Map(cast.map((person, i) => [person.slug, users[i]!]));
  const organizers = [users[0]!, users[1]!];

  const profiles: ProfileEntity[] = users.map((user, i) => ({
    userId: user.id,
    city: cast[i]!.city,
    interests: [...cast[i]!.interests],
    smartAlerts: DEFAULT_SMART_ALERTS,
    privacy: DEFAULT_PRIVACY,
    recommendationsEnabled: chance(0.9),
    bio: cast[i]!.bio,
    coverUrl: null,
    updatedAt: user.createdAt,
  }));

  // friendships: the demo owner (smoke) and the dev-initdata owner befriend generated users
  const friendships: FriendshipEntity[] = [];
  const friendshipEdges = new Set<string>();
  const addFriendship = (a: string, b: string) => {
    for (const [userId, friendUserId] of [
      [a, b],
      [b, a],
    ]) {
      const key = `${userId}->${friendUserId}`;
      if (friendshipEdges.has(key)) continue;
      friendshipEdges.add(key);
      const createdAt = shiftDays(now, -int(1, 60), int(9, 22));
      friendships.push({ id: uuid(), userId, friendUserId, closeFriend: false, createdAt, updatedAt: createdAt });
    }
  };
  users.forEach((user, i) => {
    if (i % 2 === 1) addFriendship(ownerUserId, user.id);
    if (personal && i % 3 === 0) addFriendship(devUserId, user.id);
    addFriendship(user.id, users[(i + 1) % users.length]!.id);
    addFriendship(user.id, users[(i + 4) % users.length]!.id);
  });
  if (personal) {
    for (const spec of [...AUTHORED_STORIES, ...AUTHORED_POSTS]) {
      const author = userBySlug.get(spec.authorSlug);
      if (author) addFriendship(devUserId, author.id);
    }
  }

  // places: each real venue once, at its own coordinates. No «№2» copies.
  const places: PlaceEntity[] = PLACE_POOL.map((base, i) => {
    const createdAt = shiftDays(now, -int(60, 200), 12);
    return {
      id: uuid(),
      title: base.title,
      address: base.address,
      city: DEMO_CITY,
      category: base.category,
      latitude: base.latitude,
      longitude: base.longitude,
      organizerUserId: i < 6 ? organizers[i % 2].id : null,
      published: true,
      logoUrl: PLACE_LOGOS[base.title] ?? null,
      createdAt,
      updatedAt: shiftDays(now, -int(1, 30), 12),
    };
  });

  // events: each scene stays on its own place, with the photo of that place or that evening
  const events: EventEntity[] = SCENES.slice(0, c.events).map((scene, i) => {
    const place = places.find((item) => item.title === scene.place);
    if (!place) throw new Error(`Нет площадки «${scene.place}»`);
    const startsAt = eventStart(now, scene.dayOffset, scene.hourUtc);
    const createdAt = new Date(startsAt.getTime() - int(3, 21) * 24 * HOUR_MS);
    const organizerUserId = i < 4 ? organizers[i % 2].id : null;
    return {
      id: uuid(),
      title: scene.title,
      description: scene.description,
      category: scene.category,
      city: place.city,
      placeId: place.id,
      organizerUserId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 2 * HOUR_MS),
      isPaid: scene.paid,
      priceRub: scene.paid ? scene.price : null,
      paymentUrl: scene.paid ? `https://demo-pay.max-events.local/${encodeURIComponent(scene.title)}` : null,
      capacity: scene.paid ? 40 : null,
      bookedCount: scene.paid ? int(4, 18) : int(0, 12),
      published: true,
      bookingOpensAt: null,
      chatLink: null,
      chatSyncPending: true,
      coverUrl: scene.cover,
      createdAt,
      updatedAt: createdAt,
    };
  });
  const pastEvents = events.filter((event) => event.startsAt.getTime() < now.getTime());
  const futureEvents = events.filter((event) => event.startsAt.getTime() > now.getTime());

  // organizer promo contour on a couple of the organizer-owned paid events
  const promoCodes: PromoCodeEntity[] = [events[0]!, events[2]!]
    .filter((event) => event.isPaid && event.organizerUserId !== null)
    .map((event, i) => ({
      id: uuid(),
      eventId: event.id,
      organizerUserId: event.organizerUserId!,
      code: i === 0 ? "DEMO10" : "DEMO20",
      maxRedemptions: 50,
      redeemedCount: int(1, 8),
      expiresAt: shiftDays(now, 30, 12),
      createdAt: shiftDays(now, -int(3, 10), 12),
    }));
  const promoCampaigns: PromoCampaignEntity[] = [events[4]!, events[8]!]
    .filter((event) => event.organizerUserId !== null)
    .map((event, i) => ({
      id: uuid(),
      eventId: event.id,
      organizerUserId: event.organizerUserId!,
      type: (i === 0 ? "refer_a_friend" : "special_offer") as PromoCampaignType,
      status: "active" as PromoCampaignStatus,
      code: i === 0 ? "FRIEND50" : "WELCOME10",
      title: i === 0 ? "Приведи друга — 50 бонусов" : "Скидка 10% новым гостям",
      maxFulfillments: 30,
      fulfillmentCount: int(1, 9),
      createdAt: shiftDays(now, -int(2, 9), 12),
      completedAt: null,
    }));
  const promotionCampaigns: PromotionCampaignEntity[] = events
    .filter((_, i) => i % 10 === 3)
    .slice(0, Math.ceil(c.events * 0.1))
    .map((event, k) => ({
      id: uuid(),
      eventId: event.id,
      organizerUserId: event.organizerUserId ?? organizers[k % 2].id,
      type: PROMOTION_TYPES[k % PROMOTION_TYPES.length]!,
      status: "active" as PromotionStatus,
      startsAt: shiftDays(now, -2, 9),
      endsAt: shiftDays(now, 5, 21),
      tariffCode: `demo_${int(3, 7)}d`,
      priceRub: int(6, 30) * 100,
      paidAt: shiftDays(now, -2, 10),
      audience: null,
      createdAt: shiftDays(now, -2, 9),
      completedAt: null,
    }));

  // participations: unique user+event pairs
  const participations: ParticipationEntity[] = [];
  const participationPairs = new Set<string>();
  for (let attempt = 0; participations.length < c.participations && attempt < c.participations * 50; attempt += 1) {
    const user = pick(users);
    const event = pick(events);
    const key = `${user.id}:${event.id}`;
    if (participationPairs.has(key)) continue;
    participationPairs.add(key);
    const createdAt = shiftDays(now, -int(1, 14), int(10, 22));
    participations.push({
      id: uuid(),
      userId: user.id,
      eventId: event.id,
      status: pick(["wants_to_go", "probably_going", "going", "looking_for_company", "looking_for_travel_buddy", "looking_for_after_event_company"] as const satisfies readonly ParticipationStatus[]),
      createdAt,
      updatedAt: createdAt,
    });
  }

  // bookings: future events, unique pairs, a few with the seeded demo promocode
  const promoEventId = events[2]?.isPaid === true ? events[2].id : null;
  const bookings: BookingEntity[] = [];
  const bookingPairs = new Set<string>();
  const organizerFuture = futureEvents.filter((item) => item.organizerUserId !== null);
  for (let attempt = 0; bookings.length < c.bookings && attempt < c.bookings * 50; attempt += 1) {
    const user = pick(users);
    const event = organizerFuture.length > 0 && attempt % 3 !== 2 ? organizerFuture[attempt % organizerFuture.length]! : pick(futureEvents);
    const key = `${user.id}:${event.id}`;
    if (bookingPairs.has(key)) continue;
    bookingPairs.add(key);
    const createdAt = shiftDays(now, -((bookings.length * 3) % 21), 8 + (bookings.length % 12));
    bookings.push({
      id: uuid(),
      userId: user.id,
      eventId: event.id,
      status: (bookings.length < c.bookings - 5 ? "active" : "cancelled") as BookingStatus,
      promoCode: promoEventId !== null && event.id === promoEventId && chance(0.4) ? "DEMO20" : null,
      source: (["chats", "feed", "search"] as const)[bookings.length % 3],
      createdAt,
      updatedAt: createdAt,
      reminderSentAt: null,
    });
  }

  // check-ins: half on past events, half place visits; unique per (user, event) and (user, place, day)
  // так же, как их держит база — иначе строка молча теряется на вставке.
  const checkIns: CheckInEntity[] = [];
  const visitTuples = new Set<string>();
  for (let attempt = 0; checkIns.length < c.checkIns && attempt < c.checkIns * 50; attempt += 1) {
    if (attempt % 2 === 0) {
      const event = pick(pastEvents);
      const userId = pick(users).id;
      const key = `event:${userId}:${event.id}`;
      if (visitTuples.has(key)) continue;
      visitTuples.add(key);
      checkIns.push({
        id: uuid(),
        userId,
        eventId: event.id,
        placeId: null,
        visitDate: null,
        checkedInAt: new Date(event.startsAt.getTime() + 30 * 60_000),
      });
    } else {
      const checkedInAt = shiftDays(now, -int(0, 13), int(10, 20));
      const userId = pick(users).id;
      const placeId = pick(places).id;
      const visitDate = isoDay(checkedInAt);
      const key = `place:${userId}:${placeId}:${visitDate}`;
      if (visitTuples.has(key)) continue;
      visitTuples.add(key);
      checkIns.push({
        id: uuid(),
        userId,
        eventId: null,
        placeId,
        visitDate,
        checkedInAt,
      });
    }
  }

  // stories + feed posts. Authors, captions and photos stay the same person.
  const stories: StoryEntity[] = [];
  for (const spec of AUTHORED_STORIES) {
    if (stories.length >= c.stories) break;
    const author = userBySlug.get(spec.authorSlug);
    if (!author) continue;
    const stickerEvent = spec.stickerEventTitle ? events.find((event) => event.title === spec.stickerEventTitle) : undefined;
    stories.push({
      id: uuid(),
      userId: author.id,
      imageUrl: spec.imageUrl,
      text: spec.text ?? "",
      sticker: stickerEvent ? { eventId: stickerEvent.id, title: stickerEvent.title, subtitle: stickerEvent.city, seatsLeft: stickerEvent.capacity === null ? null : Math.max(0, stickerEvent.capacity - stickerEvent.bookedCount) } : null,
      poll: spec.poll ? { question: spec.poll.question, options: [...spec.poll.options] } : null,
      audience: "city",
      objects: [],
      createdAt: new Date(now.getTime() - spec.hoursAgo * HOUR_MS),
    });
  }
  const storyAuthorIds = [...new Set(friendships.filter((row) => row.userId === ownerUserId || row.userId === devUserId).map((row) => row.friendUserId))];
  for (let i = 0; stories.length < c.stories; i += 1) {
    const place = places[i % places.length]!;
    stories.push({
      id: uuid(),
      userId: (storyAuthorIds.length > 0 ? storyAuthorIds[i % storyAuthorIds.length] : pick(users).id)!,
      imageUrl: place.logoUrl ?? "/onboarding/gorky.jpg",
      text: "",
      sticker: null,
      poll: null,
      audience: "city",
      objects: [],
      createdAt: new Date(now.getTime() - ((i % 8) + 1) * HOUR_MS),
    });
  }

  const feedPosts: FeedPostEntity[] = [];
  for (const spec of AUTHORED_POSTS) {
    const author = userBySlug.get(spec.authorSlug);
    if (!author) continue;
    const event = spec.eventTitle === null ? undefined : events.find((item) => item.title === spec.eventTitle);
    const place = spec.placeTitle === null ? undefined : places.find((item) => item.title === spec.placeTitle);
    if (spec.eventTitle !== null && !event) continue;
    const rawCreated = event !== undefined && spec.hoursAfterStart !== undefined ? new Date(event.startsAt.getTime() + spec.hoursAfterStart * HOUR_MS) : shiftDays(now, -int(1, 5), int(12, 20));
    const createdAt = rawCreated.getTime() > now.getTime() ? new Date(now.getTime() - int(2, 40) * HOUR_MS) : rawCreated;
    feedPosts.push({
      id: uuid(),
      authorUserId: author.id,
      eventId: event?.id ?? null,
      text: spec.text,
      photoUrl: spec.photoUrl,
      photoUrls: [spec.photoUrl],
      placeId: place?.id ?? event?.placeId ?? null,
      locationLabel: spec.locationLabel ?? null,
      taggedFriendIds: (spec.taggedFriendSlugs ?? []).flatMap((slug) => {
        const friend = userBySlug.get(slug);
        return friend ? [friend.id] : [];
      }),
      audience: "city",
      allowJoin: event !== undefined && event.startsAt.getTime() > now.getTime(),
      published: true,
      createdAt,
    });
  }

  // reviews on past events, unique user+event pairs, voice matches the author
  const reviews: ReviewEntity[] = [];
  const reviewPairs = new Set<string>();
  for (const spec of AUTHORED_REVIEWS) {
    if (reviews.length >= c.reviews) break;
    const author = userBySlug.get(spec.authorSlug);
    const event = events.find((item) => item.title === spec.eventTitle);
    if (!author || !event || event.startsAt.getTime() >= now.getTime()) continue;
    const key = `${author.id}:${event.id}`;
    if (reviewPairs.has(key)) continue;
    reviewPairs.add(key);
    reviews.push({
      id: uuid(),
      userId: author.id,
      eventId: event.id,
      stars: spec.stars,
      categoryScores: { atmosphere: spec.stars, organization: Math.max(3, spec.stars - 1), price: spec.stars, place: spec.stars },
      wouldGoAgain: spec.wouldGoAgain,
      photoUrls: [spec.photoUrl],
      factTags: [],
      text: spec.text,
      createdAt: new Date(event.startsAt.getTime() + int(1, 48) * HOUR_MS),
    });
  }
  for (let attempt = 0; reviews.length < c.reviews && attempt < c.reviews * 50 && pastEvents.length > 0; attempt += 1) {
    const user = pick(users);
    const event = pick(pastEvents);
    const key = `${user.id}:${event.id}`;
    if (reviewPairs.has(key)) continue;
    reviewPairs.add(key);
    const scene = sceneByTitle(event.title);
    reviews.push({
      id: uuid(),
      userId: user.id,
      eventId: event.id,
      stars: int(3, 5),
      categoryScores: { atmosphere: int(3, 5), organization: int(3, 5), price: int(3, 5), place: int(3, 5) },
      wouldGoAgain: chance(0.8),
      photoUrls: [scene.cover],
      factTags: [],
      text: scene.review,
      createdAt: new Date(event.startsAt.getTime() + int(1, 48) * HOUR_MS),
    });
  }

  // subscriptions: organizer / place / interest
  const subscriptions: SubscriptionEntity[] = [];
  for (let i = 0; i < c.subscriptions; i += 1) {
    const createdAt = shiftDays(now, -int(1, 30), int(10, 22));
    const base = { id: uuid(), userId: pick(users).id, createdAt };
    if (i % 3 === 0) subscriptions.push({ ...base, type: "organizer", organizerUserId: pick(organizers).id, placeId: null, interest: null, targetUserId: null });
    else if (i % 3 === 1) subscriptions.push({ ...base, type: "place", organizerUserId: null, placeId: pick(places).id, interest: null, targetUserId: null });
    else subscriptions.push({ ...base, type: "interest", organizerUserId: null, placeId: null, interest: pick(INTEREST_POOL), targetUserId: null });
  }

  // page views: deduped (user, targetType, targetId, viewedOn) tuples
  const pageViews: PageViewEntity[] = [];
  const viewTuples = new Set<string>();
  for (let attempt = 0; pageViews.length < c.pageViews && attempt < c.pageViews * 20; attempt += 1) {
    const user = pick(users);
    const targetType = chance(0.6) ? "event" : "place";
    const targetId = targetType === "event" ? pick(events).id : pick(places).id;
    const viewedOn = isoDay(shiftDays(now, -int(0, 13), 12));
    const key = `${user.id}:${targetType}:${targetId}:${viewedOn}`;
    if (viewTuples.has(key)) continue;
    viewTuples.add(key);
    pageViews.push({
      id: uuid(),
      userId: user.id,
      targetType,
      targetId,
      viewedOn,
      createdAt: new Date(`${viewedOn}T12:00:00.000Z`),
    });
  }

  // lists: the two shelves of the demo owner
  const lists: ListEntity[] = SHELF_PRESETS.map((preset: ListPreset) => ({
    id: uuid(),
    userId: ownerUserId,
    preset,
    title: LIST_PRESET_TITLES[preset],
    visibility: "private",
    createdAt: shiftDays(now, -int(5, 30), 12),
    updatedAt: shiftDays(now, -int(1, 10), 12),
  }));
  const listItems: ListItemEntity[] = [];
  for (let i = 0; i < 18; i += 1) {
    const useEvent = chance(0.7);
    listItems.push({
      id: uuid(),
      listId: pick(lists).id,
      eventId: useEvent ? pick(events).id : null,
      placeId: useEvent ? null : pick(places).id,
      feedPostId: null,
      addedAt: shiftDays(now, -int(1, 20), 12),
    });
  }

  // votes hosted by the demo owner, options are future events, friends vote
  const ownerFriends = users.filter((_, i) => i % 2 === 1);
  const votes: VoteEntity[] = [];
  const voteOptions: VoteOptionEntity[] = [];
  const voteParticipants: VoteParticipantEntity[] = [];
  const voteBallots: VoteBallotEntity[] = [];
  for (let i = 0; i < c.votes; i += 1) {
    const voteId = uuid();
    const createdAt = shiftDays(now, -int(1, 7), int(10, 22));
    votes.push({ id: voteId, hostUserId: ownerUserId, title: VOTE_TITLES[i % VOTE_TITLES.length]!, chatLink: null, status: "open", winnerEventId: null, createdAt, updatedAt: createdAt });
    const optionEvents = fakerRU.helpers.arrayElements(futureEvents, Math.min(3, futureEvents.length));
    optionEvents.forEach((event, position) => voteOptions.push({ id: uuid(), voteId, eventId: event.id, position }));
    const participants = ownerFriends.slice(0, Math.min(6, ownerFriends.length));
    participants.forEach((user) => voteParticipants.push({ id: uuid(), voteId, userId: user.id }));
    const ballotUsers = participants.slice(0, Math.max(1, Math.min(5, participants.length - 1)));
    ballotUsers.forEach((user) => voteBallots.push({ id: uuid(), voteId, userId: user.id, eventId: pick(optionEvents).id }));
  }

  // we-groups with members and bound events/places
  const weGroups: WeGroupEntity[] = [];
  const weGroupMembers: WeGroupMemberEntity[] = [];
  const weGroupItems: WeGroupItemEntity[] = [];
  for (let i = 0; i < c.weGroups; i += 1) {
    const groupOwner = pick(users);
    const groupId = uuid();
    const createdAt = shiftDays(now, -int(10, 60), 12);
    weGroups.push({ id: groupId, ownerUserId: groupOwner.id, title: WE_GROUP_TITLES[i % WE_GROUP_TITLES.length]!, chatLink: null, status: "active" as WeGroupStatus, createdAt, updatedAt: createdAt, archivedAt: null });
    const memberIds = new Set<string>([groupOwner.id]);
    fakerRU.helpers.arrayElements(users, Math.min(5, users.length)).forEach((user) => memberIds.add(user.id));
    memberIds.forEach((userId) => weGroupMembers.push({ id: uuid(), groupId, userId }));
    fakerRU.helpers.arrayElements(events, 2).forEach((event) => weGroupItems.push({ id: uuid(), groupId, eventId: event.id, placeId: null }));
    weGroupItems.push({ id: uuid(), groupId, eventId: null, placeId: pick(places).id });
  }

  // gatherings: friends invited to a future event
  const gatherings: GatheringEntity[] = [];
  const gatheringInvitees: GatheringInviteeEntity[] = [];
  for (let i = 0; i < c.gatherings; i += 1) {
    const host = pick(users);
    const event = pick(futureEvents);
    const gatheringId = uuid();
    const createdAt = shiftDays(now, -int(1, 5), int(10, 22));
    gatherings.push({
      id: gatheringId,
      hostUserId: host.id,
      eventId: event.id,
      proposedMeetingAt: new Date(event.startsAt.getTime() - HOUR_MS),
      status: (i % 2 === 0 ? "awaiting_responses" : "confirmed") as GatheringStatus,
      chatLink: null,
      createdAt,
      updatedAt: createdAt,
    });
    const inviteeIds = new Set<string>();
    fakerRU.helpers.arrayElements(users, Math.min(4, users.length)).forEach((user) => {
      if (user.id !== host.id) inviteeIds.add(user.id);
    });
    inviteeIds.forEach((userId) => {
      const response = pick(INVITEE_RESPONSES);
      gatheringInvitees.push({
        id: uuid(),
        gatheringId,
        userId,
        response,
        respondedAt: response === "busy" ? null : shiftDays(now, -int(0, 2), 12),
        reminderSentAt: null,
        createdAt,
        updatedAt: createdAt,
      });
    });
  }

  // micro-events with participants; the limit is drawn after the participants, because
  // MicroEventSchema refuses participantsCount > participantsLimit and the whole /micro-events
  // list then answers 500 — одна тесная запись гасит весь экран.
  const microEvents: MicroEventEntity[] = [];
  const microEventParticipants: MicroEventParticipantEntity[] = [];
  for (let i = 0; i < c.microEvents; i += 1) {
    const author = pick(users);
    const microEventId = uuid();
    const spot = [
      { title: "Забег по аллее Сокольников", place: "Сокольники" },
      { title: "Йога у арки Парка Горького", place: "Парк Горького" },
      { title: "Кофе в «Даблби» на Мясницкой", place: "Кофейня «Даблби»" },
      { title: "Прогулка по Коломенскому", place: "Коломенское" },
      { title: "Субботник в Измайловском парке", place: "Измайловский парк" },
    ][i % 5]!;
    const participantIds = new Set<string>();
    if (i % 5 < 3) {
      fakerRU.helpers.arrayElements(users, Math.min(4, users.length)).forEach((user) => {
        if (user.id !== author.id) participantIds.add(user.id);
      });
    }
    microEvents.push({
      id: microEventId,
      authorId: author.id,
      title: spot.title,
      startsAt: shiftDays(now, int(1, 14), int(10, 20)),
      locationText: null,
      placeId: places.find((item) => item.title === spot.place)?.id ?? null,
      description: "",
      listed: true,
      // Каждая пятая запись набрана под завязку: экран должен показывать и «мест нет».
      participantsLimit: i % 5 === 2 ? Math.max(3, participantIds.size) : Math.max(3, participantIds.size + int(1, 8)),
      status: "open" as MicroEventStatus,
      published: true,
      createdAt: shiftDays(now, -int(1, 10), 12),
    });
    participantIds.forEach((userId) => microEventParticipants.push({ id: uuid(), microEventId, userId }));
  }

  // plans with participants and shared expenses (two hosted by the demo owner)
  const plans: PlanEntity[] = [];
  const planParticipants: PlanParticipantEntity[] = [];
  const planExpenses: PlanExpenseEntity[] = [];
  for (let i = 0; i < c.plans; i += 1) {
    const hostUserId = i < 2 ? ownerUserId : pick(users).id;
    const event = pick(futureEvents);
    const planId = uuid();
    const createdAt = shiftDays(now, -int(1, 7), int(10, 22));
    plans.push({
      id: planId,
      hostUserId,
      eventId: event.id,
      meetingPoint: pick(MEETING_POINTS),
      meetingAt: new Date(event.startsAt.getTime() - 90 * 60_000),
      chatLink: null,
      reminderSentAt: null,
      leaveNowSentAt: null,
      weatherAlertSentAt: null,
      friendLeftBroadcastAt: null,
      recurringRule: null,
      seriesId: null,
      sourcePlanId: null,
      cancelledAt: null,
      assembledByMax: false,
      createdAt,
      updatedAt: createdAt,
    });
    const participantUsers = fakerRU.helpers.arrayElements(
      users.filter((user) => user.id !== hostUserId),
      Math.min(int(2, 4), users.length - 1),
    );
    const participantIds = participantUsers.map((user) => user.id);
    participantIds.forEach((userId) => {
      const status = pick(PLAN_PARTICIPANT_STATUSES);
      planParticipants.push({
        id: uuid(),
        planId,
        userId,
        status,
        reminderSentAt: null,
        leaveNowSentAt: null,
        friendLeftBroadcastAt: null,
        pollSentAt: null,
        createdAt,
        updatedAt: createdAt,
      });
    });
    for (let k = 0; k < int(0, 2); k += 1) {
      planExpenses.push({
        id: uuid(),
        planId,
        title: EXPENSE_TITLES[(i + k) % EXPENSE_TITLES.length]!,
        amountRub: int(6, 50) * 50,
        payerUserId: hostUserId,
        shareUserIds: [hostUserId, ...participantIds],
        createdAt,
      });
    }
  }

  // Зритель — тот, кто реально вошёл на стенд. На проде личный срез выключен: живой MAX-аккаунт
  // должен открыться пустым, а витрина города живёт за счёт каста.
  const viewer = personal
    ? buildViewerSlice({ now, viewerId: devUserId, users, organizers, places, pastEvents, futureEvents })
    : {
        lists: [],
        listItems: [],
        plans: [],
        planParticipants: [],
        planExpenses: [],
        votes: [],
        voteOptions: [],
        voteParticipants: [],
        voteBallots: [],
        weGroups: [],
        weGroupMembers: [],
        weGroupItems: [],
        gatherings: [],
        gatheringInvitees: [],
        microEvents: [],
        microEventParticipants: [],
        subscriptions: [],
        bookings: [],
        checkIns: [],
        reviews: [],
        participations: [],
        feedPosts: [],
      };
  lists.push(...viewer.lists);
  listItems.push(...viewer.listItems);
  plans.push(...viewer.plans);
  planParticipants.push(...viewer.planParticipants);
  planExpenses.push(...viewer.planExpenses);
  votes.push(...viewer.votes);
  voteOptions.push(...viewer.voteOptions);
  voteParticipants.push(...viewer.voteParticipants);
  voteBallots.push(...viewer.voteBallots);
  weGroups.push(...viewer.weGroups);
  weGroupMembers.push(...viewer.weGroupMembers);
  weGroupItems.push(...viewer.weGroupItems);
  gatherings.push(...viewer.gatherings);
  gatheringInvitees.push(...viewer.gatheringInvitees);
  microEvents.push(...viewer.microEvents);
  microEventParticipants.push(...viewer.microEventParticipants);
  subscriptions.push(...viewer.subscriptions);
  bookings.push(...viewer.bookings);
  checkIns.push(...viewer.checkIns);
  reviews.push(...viewer.reviews);
  participations.push(...viewer.participations);
  feedPosts.push(...viewer.feedPosts);

  const cityWalks: CityWalkEntity[] = personal
    ? VIEWER_WALKS.map((draft) => {
    const id = uuid();
    const createdAt = shiftDays(now, -int(2, 14), 12);
    const stops = draft.stops.map((stop, index) => {
      const place = places.find((item) => item.title === stop.placeTitle);
      return {
        order: index + 1,
        title: stop.title,
        address: stop.address,
        latitude: stop.latitude,
        longitude: stop.longitude,
        description: stop.description,
        sourceUrl: place ? `app://places/${place.id}` : "https://yandex.ru/maps",
        placeId: place?.id ?? null,
        done: index === 0,
      };
    });
    const payload: CityWalk = {
      id,
      city: draft.city,
      durationMinutes: draft.durationMinutes,
      budgetMode: draft.budgetMode,
      budgetRub: draft.budgetRub,
      interests: [...draft.interests],
      sourceLabel: draft.sourceLabel,
      fitted: draft.fitted,
      stops,
      legs: draft.legs.map((leg) => ({ ...leg })),
      createdAt: createdAt.toISOString(),
    };
    return { id, userId: devUserId, city: draft.city, payload, createdAt };
  })
    : [];

  const weGroupPhotos: WeGroupPhotoEntity[] = [];
  for (const group of weGroups) {
    const memberIds = new Set(weGroupMembers.filter((row) => row.groupId === group.id).map((row) => row.userId));
    const fromMembers = feedPosts.filter((post) => memberIds.has(post.authorUserId) && post.photoUrl);
    const picked = fromMembers.slice(0, 4);
    for (const post of picked) {
      weGroupPhotos.push({ id: uuid(), groupId: group.id, userId: post.authorUserId, url: post.photoUrl!, createdAt: post.createdAt });
    }
  }

  // Постоянные посетители: у пары людей на каждый десяток должна набираться история визитов, иначе
  // достижения остаются личной особенностью зрителя, а не свойством населения стенда.
  for (const row of checkIns) visitTuples.add(row.placeId === null ? `event:${row.userId}:${row.eventId}` : `place:${row.userId}:${row.placeId}:${row.visitDate}`);
  for (const regular of users.slice(0, Math.max(2, Math.round(c.users / 10)))) {
    places.slice(0, Math.min(11, places.length)).forEach((place, i) => {
      const checkedInAt = shiftDays(now, -(i + 2), int(11, 19));
      const visitDate = isoDay(checkedInAt);
      const key = `place:${regular.id}:${place.id}:${visitDate}`;
      if (visitTuples.has(key)) return;
      visitTuples.add(key);
      checkIns.push({ id: uuid(), userId: regular.id, eventId: null, placeId: place.id, visitDate, checkedInAt });
    });
  }

  // Лента живёт лайками и комментариями: без них у поста нет ни счётчика, ни обсуждения.
  const feedLikes: FeedLikeEntity[] = [];
  const likePairs = new Set<string>();
  for (let attempt = 0; feedLikes.length < c.feedLikes && attempt < c.feedLikes * 20; attempt += 1) {
    const post = pick(feedPosts);
    const userId = personal && attempt % 6 === 0 ? devUserId : pick(users).id;
    const key = `${post.id}:${userId}`;
    if (likePairs.has(key)) continue;
    likePairs.add(key);
    feedLikes.push({ id: uuid(), postId: post.id, userId });
  }
  const feedComments: FeedCommentEntity[] = [];
  const commentOn = (post: FeedPostEntity, authorUserId: string, text: string): void => {
    if (feedComments.length >= c.feedComments) return;
    if (authorUserId === post.authorUserId) return;
    feedComments.push({ id: uuid(), postId: post.id, authorUserId, text, createdAt: new Date(Math.min(now.getTime() - 60_000, post.createdAt.getTime() + int(1, 40) * HOUR_MS)) });
  };
  for (const spec of AUTHORED_COMMENTS) {
    const author = userBySlug.get(spec.authorSlug);
    if (!author) continue;
    const post = feedPosts.find((row) => {
      if (spec.eventTitle) {
        const event = events.find((item) => item.title === spec.eventTitle);
        return event !== undefined && row.eventId === event.id;
      }
      if (spec.placeTitle) {
        const place = places.find((item) => item.title === spec.placeTitle);
        return place !== undefined && row.placeId === place.id && row.eventId === null;
      }
      return false;
    });
    if (post) commentOn(post, author.id, spec.text);
  }
  for (let i = 0; feedComments.length < c.feedComments && feedPosts.length > 0 && i < c.feedComments * 40; i += 1) {
    commentOn(feedPosts[i % feedPosts.length]!, personal && i % 5 === 0 ? devUserId : pick(users).id, pick(COMMENT_TEXTS));
  }

  // Лист ожидания (21): несколько будущих событий добираются до потолка, очередь за ними — FIFO по
  // createdAt. Зритель стоит и в общей очереди, и держит одно приглашение с дедлайном.
  const viewerBookedEventIds = new Set(viewer.bookings.map((booking) => booking.eventId));
  const waitlistEvents = futureEvents.filter((event) => !viewerBookedEventIds.has(event.id)).slice(-3);
  for (const event of waitlistEvents) {
    event.capacity = Math.max(event.capacity ?? 0, event.bookedCount, 24);
    event.bookedCount = event.capacity;
  }
  const waitlistEntries: WaitlistEntryEntity[] = [];
  const waitlistPairs = new Set<string>();
  const nextWaitlistUser = rotator(users);
  for (let attempt = 0; waitlistEntries.length < c.waitlistEntries && attempt < c.waitlistEntries * 20 && waitlistEvents.length > 0; attempt += 1) {
    const event = waitlistEvents[attempt % waitlistEvents.length]!;
    const user = nextWaitlistUser();
    const key = `${user.id}:${event.id}`;
    if (waitlistPairs.has(key)) continue;
    waitlistPairs.add(key);
    const createdAt = shiftDays(now, -(6 + (attempt % 5)), int(10, 20));
    waitlistEntries.push({ id: uuid(), userId: user.id, eventId: event.id, status: "waiting" as WaitlistStatus, offeredUntil: null, referralCode: null, createdAt, updatedAt: createdAt });
  }
  const queueEvent = waitlistEvents[0];
  if (personal && queueEvent) {
    const createdAt = shiftDays(now, -3, 14);
    waitlistEntries.push({ id: uuid(), userId: devUserId, eventId: queueEvent.id, status: "waiting" as WaitlistStatus, offeredUntil: null, referralCode: null, createdAt, updatedAt: createdAt });
  }
  const offerEvent = waitlistEvents[1];
  if (personal && offerEvent) {
    // Приглашение висит первым в очереди: иначе «место освободилось» приходило бы не тому. Дедлайн
    // взят с запасом в двое суток — короткое окно планировщик погасил бы через час после сида.
    const createdAt = shiftDays(now, -12, 10);
    waitlistEntries.push({ id: uuid(), userId: devUserId, eventId: offerEvent.id, status: "offered" as WaitlistStatus, offeredUntil: new Date(now.getTime() + 48 * HOUR_MS), referralCode: null, createdAt, updatedAt: shiftDays(now, -1, 10) });
  }

  // Жалобы: очередь модерации по всем постмодерируемым объектам, открытые и разобранные.
  const reportTargets: Record<ReportTargetType, string[]> = { event: events.map((event) => event.id), place: places.map((place) => place.id), feed_post: feedPosts.map((post) => post.id), micro_event: microEvents.map((microEvent) => microEvent.id) };
  const reports: ReportEntity[] = [];
  const reportPairs = new Set<string>();
  for (let attempt = 0; reports.length < c.reports && attempt < c.reports * 20; attempt += 1) {
    const targetType = REPORT_TARGET_TYPES[attempt % REPORT_TARGET_TYPES.length]!;
    const pool = reportTargets[targetType];
    if (pool.length === 0) continue;
    const targetId = pick(pool);
    const userId = personal && attempt % 4 === 0 ? devUserId : pick(users).id;
    const key = `${userId}:${targetType}:${targetId}`;
    if (reportPairs.has(key)) continue;
    reportPairs.add(key);
    reports.push({ id: uuid(), userId, targetType, targetId, reason: REPORT_REASONS[attempt % REPORT_REASONS.length]!, status: (attempt % 3 === 0 ? "resolved" : "open") as ReportStatus, source: (attempt % 5 === 4 ? "spot_check" : "user") as ReportSource, createdAt: shiftDays(now, -int(1, 20), int(9, 21)) });
  }

  // Выполнения промо-кампаний: приведённый друг виден только вместе со своей бронью, поэтому она
  // создаётся здесь же, а счётчик кампании выставляется по факту, а не наугад.
  const promoFulfillments: PromoFulfillmentEntity[] = [];
  for (const campaign of promoCampaigns) {
    const event = events.find((row) => row.id === campaign.eventId);
    if (!event || event.startsAt.getTime() <= now.getTime()) continue;
    const referred = users.filter((user) => !bookingPairs.has(`${user.id}:${event.id}`)).slice(0, int(2, 5));
    for (const user of referred) {
      bookingPairs.add(`${user.id}:${event.id}`);
      const createdAt = shiftDays(now, -int(1, 8), int(11, 19));
      const booking: BookingEntity = { id: uuid(), userId: user.id, eventId: event.id, status: "active" as BookingStatus, promoCode: null, createdAt, updatedAt: createdAt, reminderSentAt: null };
      bookings.push(booking);
      promoFulfillments.push({ id: uuid(), campaignId: campaign.id, referredUserId: user.id, bookingId: booking.id, createdAt });
    }
    campaign.fulfillmentCount = referred.length;
  }

  // Платежи: один на бронь платного события; успешный несёт замороженную комиссию, отменённая бронь — возврат.
  const eventById = new Map(events.map((event) => [event.id, event]));
  const payments: PaymentEntity[] = [];
  bookings.forEach((booking, i) => {
    const event = eventById.get(booking.eventId);
    if (!event || !event.isPaid || event.priceRub === null) return;
    const status: PaymentStatus = booking.status === "cancelled" ? "refunded" : booking.userId === devUserId ? "succeeded" : i % 7 === 3 ? "pending" : "succeeded";
    const split = splitTicketSale(event.priceRub, DEFAULT_COMMISSION_BPS);
    const frozen = status === "succeeded";
    payments.push({
      id: uuid(),
      bookingId: booking.id,
      providerPaymentId: `demo-${payments.length + 1}-${booking.id.slice(0, 8)}`,
      status,
      amountRub: event.priceRub,
      currency: "RUB",
      description: `Билет: ${event.title}`.slice(0, 300),
      commissionRub: frozen ? split.commissionRub : null,
      netRub: frozen ? split.netRub : null,
      commissionBps: frozen ? DEFAULT_COMMISSION_BPS : null,
      commissionFixedAt: frozen ? new Date(booking.createdAt.getTime() + 5 * 60_000) : null,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
    });
  });

  const userAchievements = buildUserAchievements(checkIns, events, places, now);

  const swipeDecisions: SwipeDecisionEntity[] = [];
  const swipePairs = new Set<string>();
  users.forEach((user, userIndex) => {
    places.forEach((place, placeIndex) => {
      if ((userIndex + placeIndex) % 3 === 0) return;
      const key = `${user.id}:${place.id}`;
      if (swipePairs.has(key)) return;
      swipePairs.add(key);
      swipeDecisions.push({
        id: uuid(),
        userId: user.id,
        placeId: place.id,
        decision: (userIndex + placeIndex) % 5 === 0 ? "skip" : "like",
        createdAt: shiftDays(now, -int(1, 21), int(10, 21)),
      });
    });
  });

  return {
    users,
    profiles,
    friendships,
    places,
    events,
    promoCodes,
    promoCampaigns,
    promotionCampaigns,
    participations,
    bookings,
    checkIns,
    stories,
    feedPosts,
    reviews,
    subscriptions,
    pageViews,
    lists,
    listItems,
    votes,
    voteOptions,
    voteParticipants,
    voteBallots,
    weGroups,
    weGroupMembers,
    weGroupItems,
    gatherings,
    gatheringInvitees,
    microEvents,
    microEventParticipants,
    plans,
    planParticipants,
    planExpenses,
    feedLikes,
    feedComments,
    waitlistEntries,
    userAchievements,
    reports,
    payments,
    promoFulfillments,
    cityWalks,
    weGroupPhotos,
    swipeDecisions,
  };
}

// --- Database insertion ------------------------------------------------------

export type DemoSeedOptions = {
  scale: DemoScale;
  ownerMaxUserId: string;
  devMaxUserId: string;
  now?: Date;
  /** Drop generated and user-made catalog content, then insert a fresh demo. Accounts stay. */
  reset?: boolean;
  /** Fill the signed-in stand account (kku). Off on production so a real MAX login stays empty. */
  personal?: boolean;
};

/** Content tables a reset may empty. Accounts, profiles and organizations stay so a login still works. */
const RESET_CONTENT_TABLES = ["feed_comments", "feed_likes", "feed_post_going", "feed_posts", "feed_drafts", "stories", "reviews", "check_ins", "waitlist_entries", "participations", "payments", "promo_fulfillments", "bookings", "plan_expenses", "plan_participants", "plans", "gathering_invitees", "gatherings", "vote_ballots", "vote_participants", "vote_options", "votes", "we_group_photos", "we_group_items", "we_group_members", "we_groups", "micro_event_expenses", "micro_event_participants", "micro_events", "list_items", "list_members", "lists", "subscriptions", "page_views", "reports", "user_achievements", "promotion_campaigns", "promo_campaigns", "promo_codes", "event_options", "events", "place_participations", "slot_chat_messages", "slot_waitlist", "slot_bookings", "place_extras", "place_slots", "places", "city_walks", "notifications", "list_digest_sends", "swipe_decisions", "calendar_goings", "calendar_shares", "calendar_invites", "friendships"] as const;

/** Empties stale generated and user-made rows. Missing tables are skipped so an older schema still resets. */
export async function resetGeneratedContent(dataSource: DataSource): Promise<string[]> {
  const present: Array<{ tablename: string }> = await dataSource.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1)`, [RESET_CONTENT_TABLES]);
  const names = present.map((row) => row.tablename).filter((name) => (RESET_CONTENT_TABLES as readonly string[]).includes(name));
  if (names.length === 0) return [];
  const quoted = names.map((name) => `"${name}"`).join(", ");
  await dataSource.query(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
  return names;
}

export type DemoSeedResult = {
  inserted: Record<string, number>;
  totalRows: number;
  totalInserted: number;
  totalSkipped: number;
};

function isUniqueViolation(error: unknown): boolean {
  const candidate = error as { code?: string; driverError?: { code?: string } };
  return (candidate.driverError?.code ?? candidate.code) === "23505";
}

/**
 * Stories live 24 hours. A previous seed left them with yesterday's createdAt, so the rail went
 * empty even though the rows were still in the table. Re-seed bumps stale timestamps back into
 * the last eight hours instead of inserting duplicates that unique-violation skips.
 */
async function refreshStoryTimestamps(repo: Repository<StoryEntity>, now: Date): Promise<void> {
  const rows = await repo.find();
  for (const [index, row] of rows.entries()) {
    if (now.getTime() - row.createdAt.getTime() < 20 * HOUR_MS) continue;
    row.createdAt = new Date(now.getTime() - ((index % 8) + 1) * HOUR_MS);
    await repo.save(row);
  }
}

async function insertRows<T extends ObjectLiteral>(repo: Repository<T>, rows: T[]): Promise<number> {
  let inserted = 0;
  for (const row of rows) {
    try {
      await repo.insert(row);
      inserted += 1;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  return inserted;
}

async function ensureDemoUser(repo: Repository<UserEntity>, maxUserId: string, seed: { firstName: string; lastName: string | null; username: string | null }): Promise<UserEntity> {
  const existing = await repo.findOneBy({ maxUserId });
  if (existing) return existing;
  return repo.save(repo.create({ maxUserId, ...seed, avatarUrl: null, avatarCustom: false, bannedFromPublishing: false }));
}

// Pre-existing rows (base seed, smoke fixtures, previous demo run) are matched by natural keys;
// generated uuids are remapped to real row ids so FK holders point at live rows.
async function resolveRows<T extends ObjectLiteral>(repo: Repository<T>, rows: T[], keysOf: (row: T) => Record<string, unknown>): Promise<{ inserted: number; idMap: Map<string, string> }> {
  const idMap = new Map<string, string>();
  let inserted = 0;
  for (const row of rows) {
    const existing = await repo.findOneBy(keysOf(row) as never);
    if (existing) {
      idMap.set(row.id, existing.id);
      continue;
    }
    try {
      await repo.insert(row);
      inserted += 1;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const found = await repo.findOneBy(keysOf(row) as never);
      if (!found) throw error;
      idMap.set(row.id, found.id);
    }
  }
  return { inserted, idMap };
}

async function resolveCastUsers(repo: Repository<UserEntity>, rows: UserEntity[]): Promise<{ inserted: number; idMap: Map<string, string> }> {
  const idMap = new Map<string, string>();
  let inserted = 0;
  for (const row of rows) {
    const existing = await repo.findOneBy({ maxUserId: row.maxUserId });
    if (existing) {
      existing.firstName = row.firstName;
      existing.lastName = row.lastName;
      existing.username = row.username;
      if (!existing.avatarCustom) existing.avatarUrl = row.avatarUrl;
      await repo.save(existing);
      idMap.set(row.id, existing.id);
      continue;
    }
    try {
      await repo.insert(row);
      inserted += 1;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const found = await repo.findOneBy({ maxUserId: row.maxUserId });
      if (!found) throw error;
      idMap.set(row.id, found.id);
    }
  }
  return { inserted, idMap };
}

function remapUserIds(data: DemoData, idMap: Map<string, string>): void {
  const real = (id: string): string => idMap.get(id) ?? id;
  const realOpt = (id: string | null | undefined): string | null => (id == null ? null : real(id));
  for (const profile of data.profiles) profile.userId = real(profile.userId);
  for (const row of data.friendships) {
    row.userId = real(row.userId);
    row.friendUserId = real(row.friendUserId);
  }
  for (const place of data.places) place.organizerUserId = realOpt(place.organizerUserId);
  for (const event of data.events) event.organizerUserId = realOpt(event.organizerUserId);
  for (const row of data.promoCodes) row.organizerUserId = real(row.organizerUserId);
  for (const row of data.promoCampaigns) row.organizerUserId = real(row.organizerUserId);
  for (const row of data.promotionCampaigns) row.organizerUserId = real(row.organizerUserId);
  for (const row of data.participations) row.userId = real(row.userId);
  for (const row of data.bookings) row.userId = real(row.userId);
  for (const row of data.checkIns) row.userId = real(row.userId);
  for (const row of data.stories) row.userId = real(row.userId);
  for (const row of data.feedPosts) {
    row.authorUserId = real(row.authorUserId);
    row.taggedFriendIds = (row.taggedFriendIds ?? []).map(real);
  }
  for (const row of data.reviews) row.userId = real(row.userId);
  for (const row of data.subscriptions) {
    row.userId = real(row.userId);
    row.organizerUserId = realOpt(row.organizerUserId);
    row.targetUserId = realOpt(row.targetUserId);
  }
  for (const row of data.pageViews) row.userId = real(row.userId);
  for (const row of data.lists) row.userId = real(row.userId);
  for (const row of data.votes) row.hostUserId = real(row.hostUserId);
  for (const row of data.voteParticipants) row.userId = real(row.userId);
  for (const row of data.voteBallots) row.userId = real(row.userId);
  for (const row of data.weGroups) row.ownerUserId = real(row.ownerUserId);
  for (const row of data.weGroupMembers) row.userId = real(row.userId);
  for (const row of data.weGroupPhotos) row.userId = real(row.userId);
  for (const row of data.gatherings) row.hostUserId = real(row.hostUserId);
  for (const row of data.gatheringInvitees) row.userId = real(row.userId);
  for (const row of data.microEvents) row.authorId = real(row.authorId);
  for (const row of data.microEventParticipants) row.userId = real(row.userId);
  for (const row of data.plans) row.hostUserId = real(row.hostUserId);
  for (const row of data.planParticipants) row.userId = real(row.userId);
  for (const row of data.planExpenses) {
    row.payerUserId = real(row.payerUserId);
    row.shareUserIds = row.shareUserIds.map(real);
  }
  for (const row of data.feedLikes) row.userId = real(row.userId);
  for (const row of data.feedComments) row.authorUserId = real(row.authorUserId);
  for (const row of data.waitlistEntries) row.userId = real(row.userId);
  for (const row of data.userAchievements) row.userId = real(row.userId);
  for (const row of data.reports) row.userId = real(row.userId);
  for (const row of data.cityWalks) row.userId = real(row.userId);
  for (const row of data.swipeDecisions) row.userId = real(row.userId);
}

function remapEventIds(data: DemoData, idMap: Map<string, string>): void {
  const real = (id: string | null | undefined): string | null => (id == null ? null : (idMap.get(id) ?? id));
  for (const row of data.promoCodes) row.eventId = real(row.eventId) ?? row.eventId;
  for (const row of data.promoCampaigns) row.eventId = real(row.eventId) ?? row.eventId;
  for (const row of data.promotionCampaigns) row.eventId = real(row.eventId) ?? row.eventId;
  for (const row of data.participations) row.eventId = real(row.eventId) ?? row.eventId;
  for (const row of data.bookings) row.eventId = real(row.eventId) ?? row.eventId;
  for (const row of data.checkIns) row.eventId = real(row.eventId);
  for (const row of data.stories) {
    if (row.sticker && "eventId" in row.sticker && typeof row.sticker.eventId === "string") {
      row.sticker = { ...row.sticker, eventId: real(row.sticker.eventId) ?? row.sticker.eventId };
    }
  }
  for (const row of data.feedPosts) {
    row.eventId = real(row.eventId);
    row.repostOfEventId = real(row.repostOfEventId ?? null);
  }
  for (const row of data.reviews) row.eventId = real(row.eventId) ?? row.eventId;
  for (const row of data.waitlistEntries) row.eventId = real(row.eventId) ?? row.eventId;
  for (const row of data.listItems) row.eventId = real(row.eventId);
  for (const row of data.voteOptions) row.eventId = real(row.eventId) ?? row.eventId;
  for (const row of data.voteBallots) row.eventId = real(row.eventId) ?? row.eventId;
  for (const row of data.weGroupItems) row.eventId = real(row.eventId);
  for (const row of data.gatherings) row.eventId = real(row.eventId) ?? row.eventId;
  for (const row of data.plans) row.eventId = real(row.eventId) ?? row.eventId;
  for (const row of data.pageViews) {
    if (row.targetType === "event") row.targetId = real(row.targetId) ?? row.targetId;
  }
  for (const row of data.reports) {
    if (row.targetType === "event") row.targetId = real(row.targetId) ?? row.targetId;
  }
}

function remapPlaceIds(data: DemoData, idMap: Map<string, string>): void {
  const real = (id: string | null): string | null => (id === null ? null : (idMap.get(id) ?? id));
  for (const event of data.events) event.placeId = real(event.placeId);
  for (const checkIn of data.checkIns) checkIn.placeId = real(checkIn.placeId);
  for (const item of data.listItems) item.placeId = real(item.placeId);
  for (const item of data.weGroupItems) item.placeId = real(item.placeId);
  for (const subscription of data.subscriptions) subscription.placeId = real(subscription.placeId);
  for (const microEvent of data.microEvents) microEvent.placeId = real(microEvent.placeId);
  for (const post of data.feedPosts) post.placeId = real(post.placeId ?? null);
  for (const row of data.swipeDecisions) row.placeId = real(row.placeId) ?? row.placeId;
  for (const walk of data.cityWalks) {
    walk.payload.stops = walk.payload.stops.map((stop) => {
      const placeId = real(stop.placeId);
      const sourceUrl = stop.sourceUrl.startsWith("app://places/") ? `app://places/${placeId ?? stop.placeId}` : stop.sourceUrl;
      return { ...stop, placeId, sourceUrl };
    });
  }
  // У жалобы нет внешнего ключа на площадку, но очередь модерации всё равно должна открывать живую
  // карточку, а не идентификатор, которого в базе нет.
  for (const report of data.reports) {
    if (report.targetType === "place") report.targetId = real(report.targetId) ?? report.targetId;
  }
}

async function deletePostsByIds(dataSource: DataSource, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  await dataSource.getRepository(FeedCommentEntity).delete({ postId: In(ids) });
  await dataSource.getRepository(FeedLikeEntity).delete({ postId: In(ids) });
  await dataSource.getRepository(FeedPostGoingEntity).delete({ postId: In(ids) });
  await dataSource.getRepository(ListItemEntity).delete({ feedPostId: In(ids) });
  await dataSource.getRepository(ReportEntity).delete({ targetType: "feed_post", targetId: In(ids) });
  await dataSource.getRepository(FeedPostEntity).delete({ id: In(ids) });
  return ids.length;
}

/**
 * Additive seed used to keep leftover CAST posts (wrong faces, event covers, stock captions).
 * Drop those rows — likes/comments on them go with them — so the next insert writes the curated feed.
 */
async function sweepStaleDemoFeed(dataSource: DataSource): Promise<number> {
  const castIds = (await dataSource.getRepository(UserEntity).find())
    .filter((user) => user.maxUserId.startsWith(DEMO_MAX_USER_PREFIX))
    .map((user) => user.id);
  const castSet = new Set(castIds);
  const posts = await dataSource.getRepository(FeedPostEntity).find({ order: { createdAt: "DESC", id: "DESC" } });
  const stale = new Set<string>();
  const seenPhoto = new Set<string>();
  const seenText = new Set<string>();
  for (const post of posts) {
    const photo = post.photoUrl ?? "";
    const textKey = normalizeFeedText(post.text);
    if (castSet.has(post.authorUserId) || JUNK_FEED_TEXT_KEYS.has(textKey) || isEventCoverPhoto(photo)) {
      stale.add(post.id);
      continue;
    }
    if (photo !== "" && seenPhoto.has(photo)) {
      stale.add(post.id);
      continue;
    }
    if (textKey !== "" && seenText.has(textKey)) {
      stale.add(post.id);
      continue;
    }
    if (photo !== "") seenPhoto.add(photo);
    if (textKey !== "") seenText.add(textKey);
  }
  const deleted = await deletePostsByIds(dataSource, [...stale]);
  if (castIds.length > 0) {
    const stories = await dataSource.getRepository(StoryEntity).find();
    const storyIds = stories.filter((row) => castSet.has(row.userId)).map((row) => row.id);
    if (storyIds.length > 0) await dataSource.getRepository(StoryEntity).delete({ id: In(storyIds) });
    await dataSource.getRepository(FeedCommentEntity).delete({ authorUserId: In(castIds) });
    return deleted + storyIds.length;
  }
  return deleted;
}

async function upsertDemoEvents(repo: Repository<EventEntity>, rows: EventEntity[]): Promise<{ inserted: number; idMap: Map<string, string> }> {
  const idMap = new Map<string, string>();
  let inserted = 0;
  const existing = await repo.find();
  const untitled = existing.filter((row) => (row.source == null || row.source === "") && (row.organizerOrganizationId == null || row.organizerOrganizationId === undefined));
  for (const row of rows) {
    const matches = untitled.filter((event) => event.title === row.title && event.city === row.city).sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id));
    const kept = matches[0];
    if (!kept) {
      try {
        await repo.insert(row);
        inserted += 1;
        untitled.push(row);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
      continue;
    }
    idMap.set(row.id, kept.id);
    kept.startsAt = row.startsAt;
    kept.endsAt = row.endsAt;
    kept.coverUrl = row.coverUrl;
    kept.description = row.description;
    kept.placeId = row.placeId ?? kept.placeId;
    kept.published = true;
    await repo.save(kept);
    for (const extra of matches.slice(1)) {
      extra.published = false;
      await repo.save(extra);
    }
  }
  return { inserted, idMap };
}

async function fillOrganizerCabinet(dataSource: DataSource, now: Date): Promise<number> {
  const orgs = await dataSource.getRepository(OrganizationEntity).find();
  if (orgs.length === 0) return 0;
  const places = await dataSource.getRepository(PlaceEntity).find();
  const guests = (await dataSource.getRepository(UserEntity).find()).filter((user) => user.maxUserId.startsWith(String(DEMO_USER_ID_BASE).slice(0, 6)));
  const eventsRepo = dataSource.getRepository(EventEntity);
  const bookingsRepo = dataSource.getRepository(BookingEntity);
  const reviewsRepo = dataSource.getRepository(ReviewEntity);
  const checkInsRepo = dataSource.getRepository(CheckInEntity);
  const participationsRepo = dataSource.getRepository(ParticipationEntity);
  const promoRepo = dataSource.getRepository(PromoCampaignEntity);
  const paymentsRepo = dataSource.getRepository(PaymentEntity);
  let inserted = 0;
  const placeByTitle = new Map(places.map((place) => [place.title, place]));

  for (const org of orgs) {
    if (org.organizerUserId === null) continue;
    for (const [index, spec] of ORGANIZER_SHOWCASE.entries()) {
      const place = placeByTitle.get(spec.place) ?? null;
      let event = await eventsRepo.findOneBy({ title: spec.title, organizerOrganizationId: org.id });
      const startsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + spec.dayOffset, spec.hourUtc, 0));
      const endsAt = new Date(startsAt.getTime() + spec.durationHours * HOUR_MS);
      const createdAt = new Date(startsAt.getTime() - 5 * 24 * HOUR_MS);
      if (!event) {
        event = eventsRepo.create({
          title: spec.title,
          description: spec.description,
          category: spec.category,
          city: DEMO_CITY,
          placeId: place?.id ?? null,
          organizerUserId: org.organizerUserId,
          organizerOrganizationId: org.id,
          startsAt,
          endsAt,
          isPaid: spec.paid,
          priceRub: spec.price,
          paymentUrl: spec.paymentUrl,
          capacity: spec.capacity,
          bookedCount: 0,
          published: true,
          bookingOpensAt: null,
          chatLink: null,
          chatSyncPending: true,
          coverUrl: spec.cover,
          createdAt,
          updatedAt: createdAt,
        });
        await eventsRepo.save(event);
        inserted += 1;
      } else {
        event.placeId = event.placeId ?? place?.id ?? null;
        event.coverUrl = spec.cover;
        event.startsAt = startsAt;
        event.endsAt = endsAt;
        event.description = spec.description;
        event.organizerUserId = org.organizerUserId;
        await eventsRepo.save(event);
      }
      const past = startsAt.getTime() < now.getTime();
      const guestSlice = guests.slice(0, past ? 8 : 6);
      for (const [guestIndex, guest] of guestSlice.entries()) {
        if (spec.capacity !== null || spec.paid) {
          const bookingId = fakerRU.string.uuid();
          const bookingCreated = new Date(startsAt.getTime() - (guestIndex + 1) * 24 * HOUR_MS);
          const bookingStatus = guestIndex === guestSlice.length - 1 && !past ? "cancelled" : "active";
          try {
            await bookingsRepo.insert({
              id: bookingId,
              userId: guest.id,
              eventId: event.id,
              status: bookingStatus,
              promoCode: null,
              source: (["chats", "feed", "search"] as const)[guestIndex % 3],
              createdAt: bookingCreated,
              updatedAt: bookingCreated,
              reminderSentAt: null,
            });
            inserted += 1;
            if (spec.paid && spec.price !== null) {
              const status = bookingStatus === "cancelled" ? "refunded" : "succeeded";
              const split = splitTicketSale(spec.price, DEFAULT_COMMISSION_BPS);
              const frozen = status === "succeeded";
              await paymentsRepo.insert({
                id: fakerRU.string.uuid(),
                bookingId,
                providerPaymentId: `org-${bookingId.slice(0, 8)}`,
                status,
                amountRub: spec.price,
                currency: "RUB",
                description: `Билет: ${spec.title}`.slice(0, 300),
                commissionRub: frozen ? split.commissionRub : null,
                netRub: frozen ? split.netRub : null,
                commissionBps: frozen ? DEFAULT_COMMISSION_BPS : null,
                commissionFixedAt: frozen ? new Date(bookingCreated.getTime() + 5 * 60_000) : null,
                createdAt: bookingCreated,
                updatedAt: bookingCreated,
              });
              inserted += 1;
            }
          } catch (error) {
            if (!isUniqueViolation(error)) throw error;
          }
        }
        if (past) {
          try {
            await checkInsRepo.insert({
              id: fakerRU.string.uuid(),
              userId: guest.id,
              eventId: event.id,
              placeId: null,
              visitDate: null,
              checkedInAt: new Date(startsAt.getTime() + 30 * 60_000),
            });
            inserted += 1;
          } catch (error) {
            if (!isUniqueViolation(error)) throw error;
          }
        }
        try {
          await participationsRepo.insert({
            id: fakerRU.string.uuid(),
            userId: guest.id,
            eventId: event.id,
            status: guestIndex % 2 === 0 ? "going" : "wants_to_go",
            createdAt,
            updatedAt: createdAt,
          });
          inserted += 1;
        } catch (error) {
          if (!isUniqueViolation(error)) throw error;
        }
      }
      if (past) {
        const reviewText = ORGANIZER_REVIEW_TEXTS[spec.title] ?? spec.description;
        for (const [guestIndex, guest] of guests.slice(0, 5).entries()) {
          try {
            await reviewsRepo.insert({
              id: fakerRU.string.uuid(),
              userId: guest.id,
              eventId: event.id,
              stars: (4 + (guestIndex % 2)) as 4 | 5,
              categoryScores: { atmosphere: 5, organization: 4, price: spec.paid ? 4 : 5, place: 5 },
              wouldGoAgain: true,
              photoUrls: [spec.cover],
              factTags: [],
              text: reviewText,
              createdAt: new Date(startsAt.getTime() + (guestIndex + 2) * HOUR_MS),
            });
            inserted += 1;
          } catch (error) {
            if (!isUniqueViolation(error)) throw error;
          }
        }
      }
      const activeBookings = await bookingsRepo.count({ where: { eventId: event.id, status: "active" } });
      event.bookedCount = spec.capacity === null ? activeBookings : Math.min(spec.capacity, Math.max(activeBookings, Math.round((spec.capacity ?? 0) * (0.35 + (index % 5) * 0.1))));
      if (spec.capacity !== null && event.bookedCount > spec.capacity) event.bookedCount = spec.capacity;
      await eventsRepo.save(event);
      if (spec.paid && !past && org.organizerUserId) {
        const existingPromo = await promoRepo.findOneBy({ eventId: event.id, organizerUserId: org.organizerUserId });
        if (!existingPromo) {
          await promoRepo.insert({
            id: fakerRU.string.uuid(),
            eventId: event.id,
            organizerUserId: org.organizerUserId,
            type: "special_offer",
            status: "active",
            code: `ORG${index}`,
            title: "Скидка 10% новым гостям",
            maxFulfillments: 30,
            fulfillmentCount: 3,
            createdAt,
            completedAt: null,
          });
          inserted += 1;
        }
      }
    }
    for (const place of places.slice(0, 8)) {
      if (place.organizerOrganizationId) continue;
      place.organizerOrganizationId = org.id;
      place.organizerUserId = place.organizerUserId ?? org.organizerUserId;
      if (!place.logoUrl) place.logoUrl = PLACE_LOGOS[place.title] ?? place.logoUrl;
      await dataSource.getRepository(PlaceEntity).save(place);
    }
  }
  return inserted;
}

export async function seedDemoDatabase(dataSource: DataSource, options: DemoSeedOptions): Promise<DemoSeedResult> {
  if (options.reset) await resetGeneratedContent(dataSource);
  const now = options.now ?? new Date();
  const usersRepo = dataSource.getRepository(UserEntity);
  const owner = await ensureDemoUser(usersRepo, options.ownerMaxUserId, { firstName: "Smoke", lastName: "Runner", username: "max_events_smoke" });
  const personal = options.personal !== false;
  const dev = personal ? await ensureDemoUser(usersRepo, options.devMaxUserId, { firstName: "Михаил", lastName: null, username: "seaG7" }) : owner;
  const data = buildDemoData({ now, scale: options.scale, ownerUserId: owner.id, devUserId: dev.id, personal });

  // Люди идут первыми: у площадки есть organizerUserId со внешним ключом на users, и на пустой базе
  // вставка площадок до людей падает по FK_places_organizer. Раньше порядок сходил с рук только
  // потому, что на обжитой базе площадки находились уже существующими и не вставлялись вовсе.
  const inserted: Record<string, number> = {};
  const users = await resolveCastUsers(usersRepo, data.users);
  remapUserIds(data, users.idMap);
  inserted.users = users.inserted;
  const profilesRepo = dataSource.getRepository(ProfileEntity);
  let profilesInserted = 0;
  for (const profile of data.profiles) {
    const existing = await profilesRepo.findOneBy({ userId: profile.userId });
    if (existing) {
      existing.city = profile.city;
      existing.interests = profile.interests;
      existing.bio = profile.bio;
      await profilesRepo.save(existing);
      continue;
    }
    try {
      await profilesRepo.insert(profile);
      profilesInserted += 1;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  inserted.profiles = profilesInserted;
  inserted.friendships = await insertRows(dataSource.getRepository(FriendshipEntity), data.friendships);

  const places = await resolveRows(dataSource.getRepository(PlaceEntity), data.places, (place) => ({ title: place.title, address: place.address, city: place.city }));
  remapPlaceIds(data, places.idMap);
  const placesRepo = dataSource.getRepository(PlaceEntity);
  for (const place of await placesRepo.find()) {
    const logoUrl = PLACE_LOGOS[place.title];
    if (!logoUrl || place.logoUrl === logoUrl) continue;
    place.logoUrl = logoUrl;
    await placesRepo.save(place);
  }
  // Пресет узнаётся по (userId, preset), собственный список пресета не имеет — его различает заголовок.
  const lists = await resolveRows(dataSource.getRepository(ListEntity), data.lists, (list) => (list.preset === null ? { userId: list.userId, title: list.title } : { userId: list.userId, preset: list.preset }));
  for (const item of data.listItems) item.listId = lists.idMap.get(item.listId) ?? item.listId;

  inserted.places = places.inserted;
  inserted.staleFeed = await sweepStaleDemoFeed(dataSource);
  const events = await upsertDemoEvents(dataSource.getRepository(EventEntity), data.events);
  remapEventIds(data, events.idMap);
  inserted.events = events.inserted;
  inserted.promoCodes = await insertRows(dataSource.getRepository(PromoCodeEntity), data.promoCodes);
  inserted.promoCampaigns = await insertRows(dataSource.getRepository(PromoCampaignEntity), data.promoCampaigns);
  inserted.promotionCampaigns = await insertRows(dataSource.getRepository(PromotionCampaignEntity), data.promotionCampaigns);
  inserted.participations = await insertRows(dataSource.getRepository(ParticipationEntity), data.participations);
  inserted.bookings = await insertRows(dataSource.getRepository(BookingEntity), data.bookings);
  inserted.payments = await insertRows(dataSource.getRepository(PaymentEntity), data.payments);
  inserted.promoFulfillments = await insertRows(dataSource.getRepository(PromoFulfillmentEntity), data.promoFulfillments);
  inserted.waitlistEntries = await insertRows(dataSource.getRepository(WaitlistEntryEntity), data.waitlistEntries);
  inserted.checkIns = await insertRows(dataSource.getRepository(CheckInEntity), data.checkIns);
  inserted.userAchievements = await insertRows(dataSource.getRepository(UserAchievementEntity), data.userAchievements);
  inserted.stories = await insertRows(dataSource.getRepository(StoryEntity), data.stories);
  await refreshStoryTimestamps(dataSource.getRepository(StoryEntity), now);
  inserted.feedPosts = await insertRows(dataSource.getRepository(FeedPostEntity), data.feedPosts);
  inserted.feedLikes = await insertRows(dataSource.getRepository(FeedLikeEntity), data.feedLikes);
  inserted.feedComments = await insertRows(dataSource.getRepository(FeedCommentEntity), data.feedComments);
  inserted.reports = await insertRows(dataSource.getRepository(ReportEntity), data.reports);
  inserted.reviews = await insertRows(dataSource.getRepository(ReviewEntity), data.reviews);
  inserted.subscriptions = await insertRows(dataSource.getRepository(SubscriptionEntity), data.subscriptions);
  inserted.pageViews = await insertRows(dataSource.getRepository(PageViewEntity), data.pageViews);
  inserted.lists = lists.inserted;
  inserted.listItems = await insertRows(dataSource.getRepository(ListItemEntity), data.listItems);
  inserted.votes = await insertRows(dataSource.getRepository(VoteEntity), data.votes);
  inserted.voteOptions = await insertRows(dataSource.getRepository(VoteOptionEntity), data.voteOptions);
  inserted.voteParticipants = await insertRows(dataSource.getRepository(VoteParticipantEntity), data.voteParticipants);
  inserted.voteBallots = await insertRows(dataSource.getRepository(VoteBallotEntity), data.voteBallots);
  inserted.weGroups = await insertRows(dataSource.getRepository(WeGroupEntity), data.weGroups);
  inserted.weGroupMembers = await insertRows(dataSource.getRepository(WeGroupMemberEntity), data.weGroupMembers);
  inserted.weGroupItems = await insertRows(dataSource.getRepository(WeGroupItemEntity), data.weGroupItems);
  inserted.weGroupPhotos = await insertRows(dataSource.getRepository(WeGroupPhotoEntity), data.weGroupPhotos);
  inserted.gatherings = await insertRows(dataSource.getRepository(GatheringEntity), data.gatherings);
  inserted.gatheringInvitees = await insertRows(dataSource.getRepository(GatheringInviteeEntity), data.gatheringInvitees);
  inserted.microEvents = await insertRows(dataSource.getRepository(MicroEventEntity), data.microEvents);
  inserted.microEventParticipants = await insertRows(dataSource.getRepository(MicroEventParticipantEntity), data.microEventParticipants);
  inserted.plans = await insertRows(dataSource.getRepository(PlanEntity), data.plans);
  inserted.planParticipants = await insertRows(dataSource.getRepository(PlanParticipantEntity), data.planParticipants);
  inserted.planExpenses = await insertRows(dataSource.getRepository(PlanExpenseEntity), data.planExpenses);
  inserted.cityWalks = await insertRows(dataSource.getRepository(CityWalkEntity), data.cityWalks);
  inserted.swipeDecisions = await insertRows(dataSource.getRepository(SwipeDecisionEntity), data.swipeDecisions);
  inserted.organizerCabinet = await fillOrganizerCabinet(dataSource, now);

  const totalRows = Object.values(data).reduce((sum, rows) => sum + rows.length, 0);
  const totalInserted = Object.values(inserted).reduce((sum, count) => sum + count, 0);
  return { inserted, totalRows, totalInserted, totalSkipped: totalRows - totalInserted };
}
