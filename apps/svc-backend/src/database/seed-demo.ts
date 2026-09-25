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
// - buildViewerSlice - the viewer's own plans, groups, votes, subscriptions, bookings, lists, visits and collections
// - buildUserAchievements - grants derived from the generated check-ins, by the same catalog the API reads
// - buildDemoData - pure generation of all demo rows (deterministic ids via fakerRU.seed(42))
// - seedDemoDatabase - ensure owner users, build data, insert tables in dependency order
// - DemoData - generated rows per table
// - DemoSeedResult - inserted counters plus totals
// END_MODULE_MAP

import "reflect-metadata";
import { fakerRU } from "@faker-js/faker";
import { DEFAULT_PRIVACY, DEFAULT_SMART_ALERTS, ListPresetSchema, type AchievementCode, type BookingStatus, type CollectionSection, type EventCategory, type GatheringStatus, type InviteeResponse, type ListPreset, type MicroEventStatus, type ParticipationStatus, type PaymentStatus, type PlaceCategory, type PlanParticipantStatus, type PromoCampaignStatus, type PromoCampaignType, type PromotionStatus, type PromotionType, type ReportReason, type ReportSource, type ReportStatus, type ReportTargetType, type WaitlistStatus, type WeGroupStatus } from "@max-events/api-contracts";
import type { DataSource, ObjectLiteral, Repository } from "typeorm";
import { ACHIEVEMENT_CATALOG } from "../achievements/achievements.service";
import { UserAchievementEntity } from "../achievements/user-achievement.entity";
import { BookingEntity } from "../bookings/booking.entity";
import { CheckInEntity } from "../checkins/check-in.entity";
import { CollectionEntity, CollectionItemEntity, CollectionMemberEntity } from "../collections/collection.entity";
import { FeedCommentEntity, FeedLikeEntity, FeedPostEntity } from "../feed/feed-post.entity";
import { FriendshipEntity } from "../friends/friendship.entity";
import { EventEntity } from "../events/event.entity";
import { GatheringEntity } from "../gatherings/gathering.entity";
import { GatheringInviteeEntity } from "../gatherings/gathering-invitee.entity";
import { ListItemEntity } from "../lists/list-item.entity";
import { ListEntity } from "../lists/list.entity";
import { LIST_PRESET_TITLES } from "../lists/lists.service";
import { MicroEventEntity, MicroEventParticipantEntity } from "../microevents/micro-event.entity";
import { districtKey } from "../mycity/my-city.service";
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
import { WeGroupEntity, WeGroupItemEntity, WeGroupMemberEntity } from "../wegroups/we-group.entity";

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
  collections: number;
  waitlistEntries: number;
  reports: number;
};

export const DEMO_COUNTS: Record<DemoScale, DemoCounts> = {
  small: { users: 10, places: 10, events: 24, stories: 5, feedPosts: 12, reviews: 15, checkIns: 18, bookings: 10, participations: 20, plans: 3, votes: 2, weGroups: 1, gatherings: 1, microEvents: 4, subscriptions: 5, pageViews: 60, feedLikes: 20, feedComments: 8, collections: 1, waitlistEntries: 4, reports: 3 },
  normal: { users: 30, places: 25, events: 80, stories: 15, feedPosts: 40, reviews: 50, checkIns: 60, bookings: 30, participations: 60, plans: 10, votes: 5, weGroups: 3, gatherings: 3, microEvents: 10, subscriptions: 15, pageViews: 200, feedLikes: 70, feedComments: 25, collections: 3, waitlistEntries: 10, reports: 8 },
  big: { users: 75, places: 60, events: 200, stories: 40, feedPosts: 100, reviews: 120, checkIns: 150, bookings: 75, participations: 150, plans: 25, votes: 12, weGroups: 7, gatherings: 7, microEvents: 25, subscriptions: 40, pageViews: 500, feedLikes: 180, feedComments: 60, collections: 7, waitlistEntries: 25, reports: 20 },
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
const HOUR_MS = 3_600_000;

const PLACE_POOL: ReadonlyArray<{ title: string; address: string; category: PlaceCategory; latitude: number; longitude: number }> = [
  { title: "Парк Горького", address: "ул. Крымский Вал, 9", category: "park", latitude: 55.7297, longitude: 37.6014 },
  { title: "Сокольники", address: "5-й Лучевой просек, 3", category: "park", latitude: 55.793, longitude: 37.6768 },
  { title: "ВДНХ", address: "пр-т Мира, 119, стр. 1", category: "park", latitude: 55.8263, longitude: 37.6377 },
  { title: "Парк «Зарядье»", address: "ул. Варварка, 6с1", category: "park", latitude: 55.752, longitude: 37.6232 },
  { title: "Коломенское", address: "пр-т Андропова, 39", category: "park", latitude: 55.6675, longitude: 37.671 },
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
];

const EVENT_CATEGORIES = ["afisha", "volunteering", "tourism", "sport"] as const satisfies readonly EventCategory[];

const EVENT_TITLES: Record<EventCategory, string[]> = {
  afisha: ["Лекция «Города будущего»", "Концерт инди-группы «Сирень»", "Вечер авторской песни", "Открытый показ документального кино", "Литературный вечер в библиотеке", "Джазовый вечер", "Выставка современного фотоискусства", "Кинопоказ под открытым небом", "Лекция «Как смотреть на искусство»", "Концерт камерного оркестра", "Творческая встреча с художником", "Вечер настольных игр в антикафе"],
  volunteering: ["Субботник в парке", "Помощь приюту для животных", "Сбор гуманитарной помощи", "Эко-патруль у реки", "Благоустройство школьного двора", "Помощь пожилым соседям", "Раздача еды нуждающимся", "Выставка-ярмарка добрых дел", "Ликвидация незаконных свалок", "Помощь конному приюту", "Озеленение дворов", "Волонтёрский интенсив для новичков"],
  tourism: ["Пешая экскурсия по центру Москвы", "Веломаршрут по набережным", "Экскурсия в Коломенское", "Поход выходного дня", "Обзорная экскурсия по Замоскворечью", "Ночная фотопрогулка по городу", "Экскурсия на ВДНХ", "Загородная поездка в усадьбу Абрамцево", "Прогулка на кораблике по Москве-реке", "Экскурсия «Тайны старых переулков»", "Гастрономический тур по Мясницкой", "Однодневная поездка в Сергиев Посад"],
  sport: ["Утренняя йога в парке", "Пробежка 5 км с клубом", "Открытая тренировка по ОФП", "Турнир по настольному теннису", "Скандинавская ходьба для начинающих", "Велопарад по вечерней Москве", "Тренировка по воркауту", "Матч любительской лиги по футболу", "Соревнования по ориентированию", "Кроссфит на открытом воздухе", "Плавание в открытом бассейне", "Чемпионат по стритболу"],
};

const EVENT_DESCRIPTIONS = ["Вход по предварительной регистрации, приходите за 15 минут до начала.", "Место сбора — главный вход. Возьмите с собой воду и удобную обувь.", "Программа подойдёт и новичкам, и опытным участникам.", "Организаторы ответят на вопросы после основной части.", "Количество мест ограничено, не опаздывайте.", "С собой можно брать друзей — вход свободный."];

const FEED_TEXTS = ["Отличное мероприятие, советую всем!", "Была вчера — восторг!", "Кто идёт? Пишите в чат.", "Собираем компанию на выходные.", "Впечатлений море, обязательно повторим.", "Лучшая суббота за месяц.", "Только вернулись — до сих пор под впечатлением.", "Спасибо организаторам!", "Идём с друзьями, присоединяйтесь.", "Место легко найти, вход свободный."];

const REVIEW_TEXTS = ["Всё прошло отлично, вернёмся ещё.", "Организация на высоте.", "Начало задержали на 15 минут, но в целом неплохо.", "Атмосфера супер, народу немного.", "Понравилось, в следующий раз возьму друзей.", "Событие оправдало ожидания."];

const MEETING_POINTS = ["У входа в метро «Парк культуры»", "У центрального фонтана", "У билетных касс", "У главного входа в парк", "У фудкорта", "У сцены"];

const MICRO_EVENT_TITLES = ["Бегаем 5 км в парке", "Ищу компанию на настолки", "Прогулка с фотографом по центру", "Кофе и разговорный английский", "Велопрокат и прогулка по набережной", "Пикник в Зарядье", "Настолки в антикафе", "Утренняя медитация в парке", "Ищу компанию в кино", "Пешая прогулка по Бульварному кольцу"];

const MICRO_LOCATIONS = ["У входа в метро", "У центрального входа в парк", "В антикафе на Покровке", "У фудкорта", "У фонтана"];

const INTEREST_POOL = ["Спорт", "Музыка", "Искусство", "Гастрономия", "Путешествия", "Настольные игры", "Волонтёрство", "Театр", "Кино", "Фотография", "Бег", "Лекции"];

const VOTE_TITLES = ["Куда идём в субботу?", "Выбираем событие на выходные", "Голосуем за план на вечер", "Что делаем в пятницу?", "Куда сходить большой компанией?"];

const WE_GROUP_TITLES = ["Мы: уикенды в парках", "Мы: велопрогулки", "Мы: любители искусства"];

const EXPENSE_TITLES = ["Билеты", "Ужин после события", "Транспорт", "Аренда инвентаря"];

const PLAN_PARTICIPANT_STATUSES = ["invited", "confirmed", "declined"] as const satisfies readonly PlanParticipantStatus[];
const INVITEE_RESPONSES = ["accepted", "considering", "busy"] as const satisfies readonly InviteeResponse[];
const PROMOTION_TYPES = ["boost", "banner", "pin"] as const satisfies readonly PromotionType[];

const COMMENT_TEXTS = ["Тоже там были, отличный вечер.", "А во сколько собираетесь?", "Присоединюсь в следующий раз.", "Спасибо, забрал в свой список.", "Место и правда хорошее.", "Мы рядом живём, дойдём пешком."];

const REPORT_REASONS = ["spam", "abuse", "inaccurate", "inappropriate", "other"] as const satisfies readonly ReportReason[];
const REPORT_TARGET_TYPES = ["event", "place", "feed_post", "micro_event"] as const satisfies readonly ReportTargetType[];

const COLLECTION_SECTIONS = ["want_to_go", "already_been", "weekend_ideas"] as const satisfies readonly CollectionSection[];
const COLLECTION_TITLES = ["Общая подборка выходных", "Куда сходить компанией", "Идеи на отпуск", "Любимые места района"];

// Зритель — человек, который реально входит на стенд. Его строки названы отдельно, чтобы экраны
// «про меня» читались как чей-то живой аккаунт, а не как чужая витрина.
const VIEWER_CUSTOM_LIST_TITLE = "Мой маршрут на осень";
const VIEWER_COLLECTION_TITLE = "Наша общая подборка";
const VIEWER_WE_GROUP_TITLES = ["Мы: субботние вылазки", "Мы: музейный клуб", "Мы: летние поездки"] as const;
const VIEWER_MICRO_EVENT_TITLES = ["Зову на утренний забег", "Ищу компанию в музей"] as const;

// --- Pure generation ---------------------------------------------------------

export type DemoBuildConfig = { now: Date; scale: DemoScale; ownerUserId: string; devUserId: string };

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
  collections: CollectionEntity[];
  collectionMembers: CollectionMemberEntity[];
  collectionItems: CollectionItemEntity[];
  waitlistEntries: WaitlistEntryEntity[];
  userAchievements: UserAchievementEntity[];
  reports: ReportEntity[];
  payments: PaymentEntity[];
  promoFulfillments: PromoFulfillmentEntity[];
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

function picsum(slug: string): string {
  return `https://picsum.photos/seed/${slug}/600/400`;
}

function shiftDays(base: Date, days: number, hourUtc: number): Date {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + days, hourUtc, int(0, 45)));
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function pickInterests(): string[] {
  return fakerRU.helpers.arrayElements(INTEREST_POOL, int(2, 4));
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
  collections: CollectionEntity[];
  collectionMembers: CollectionMemberEntity[];
  collectionItems: CollectionItemEntity[];
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
  const lists: ListEntity[] = ListPresetSchema.options.map((preset: ListPreset) => ({ id: uuid(), userId: viewerId, preset, title: LIST_PRESET_TITLES[preset], createdAt: shiftDays(now, -int(14, 40), 12), updatedAt: shiftDays(now, -int(1, 9), 12) }));
  lists.push({ id: uuid(), userId: viewerId, preset: null, title: VIEWER_CUSTOM_LIST_TITLE, createdAt: shiftDays(now, -12, 12), updatedAt: shiftDays(now, -2, 12) });
  const listItems: ListItemEntity[] = [];
  const listTargets = new Set<string>();
  for (const list of lists) {
    for (let k = 0; k < 3; k += 1) {
      const useEvent = k < 2;
      const targetId = useEvent ? nextFuture().id : pick(places).id;
      const key = `${list.id}:${targetId}`;
      if (listTargets.has(key)) continue;
      listTargets.add(key);
      listItems.push({ id: uuid(), listId: list.id, eventId: useEvent ? targetId : null, placeId: useEvent ? null : targetId, addedAt: shiftDays(now, -int(1, 18), 12) });
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
    plans.push({ id: planId, hostUserId, eventId: event.id, meetingPoint, meetingAt: new Date(event.startsAt.getTime() - 90 * 60_000), chatLink: null, reminderSentAt: null, leaveNowSentAt: null, weatherAlertSentAt: null, friendLeftBroadcastAt: null, recurringRule: null, seriesId: null, sourcePlanId: null, cancelledAt: null, createdAt, updatedAt: createdAt });
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
  microEvents.push({ id: ownedMicroId, authorId: viewerId, title: VIEWER_MICRO_EVENT_TITLES[0], startsAt: shiftDays(now, int(2, 9), 9), locationText: null, placeId: pick(places).id, participantsLimit: int(4, 10), status: "open" as MicroEventStatus, published: true, createdAt: shiftDays(now, -3, 12) });
  microEventParticipants.push({ id: uuid(), microEventId: ownedMicroId, userId: friend(0).id }, { id: uuid(), microEventId: ownedMicroId, userId: friend(1).id });
  const joinedMicroId = uuid();
  microEvents.push({ id: joinedMicroId, authorId: friend(2).id, title: VIEWER_MICRO_EVENT_TITLES[1], startsAt: shiftDays(now, int(3, 12), 15), locationText: pick(MICRO_LOCATIONS), placeId: null, participantsLimit: int(4, 10), status: "open" as MicroEventStatus, published: true, createdAt: shiftDays(now, -5, 12) });
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
  [groupPastEvent, ...afishaVisits.slice(0, 2)].forEach((event, i) => {
    if (reviews.some((row) => row.eventId === event.id)) return;
    reviews.push({ id: uuid(), userId: viewerId, eventId: event.id, stars: int(4, 5), categoryScores: { atmosphere: int(4, 5), organization: int(3, 5), price: int(3, 5), place: int(4, 5) }, wouldGoAgain: true, photoUrls: i === 0 ? [picsum("demo-viewer-review-1"), picsum("demo-viewer-review-2")] : [], text: pick(REVIEW_TEXTS), createdAt: new Date(event.startsAt.getTime() + int(2, 30) * HOUR_MS) });
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

  const feedPosts: FeedPostEntity[] = [groupPastEvent, hostedPlanEvent].map((event, i) => ({ id: uuid(), authorUserId: viewerId, eventId: event.id, text: FEED_TEXTS[i % FEED_TEXTS.length]!, photoUrl: picsum(`demo-viewer-post-${i}`), published: true, createdAt: new Date(now.getTime() - int(2, 90) * HOUR_MS) }));

  // Коллекции: одна общая, собранная зрителем, и одна, куда его позвали.
  const collections: CollectionEntity[] = [];
  const collectionMembers: CollectionMemberEntity[] = [];
  const collectionItems: CollectionItemEntity[] = [];
  const addCollection = (ownerUserId: string, title: string, memberIds: string[], itemCount: number, createdDaysAgo: number): void => {
    const collectionId = uuid();
    const createdAt = shiftDays(now, -createdDaysAgo, 12);
    collections.push({ id: collectionId, ownerUserId, title, chatLink: null, createdAt, updatedAt: createdAt });
    const members = [...new Set(memberIds)];
    members.forEach((userId) => collectionMembers.push({ id: uuid(), collectionId, userId }));
    takeDistinct(nextFuture, itemCount).forEach((event, i) => collectionItems.push({ id: uuid(), collectionId, eventId: event.id, section: COLLECTION_SECTIONS[i % COLLECTION_SECTIONS.length]!, addedByUserId: members[i % members.length]!, addedAt: shiftDays(now, -int(1, createdDaysAgo), 12) }));
  };
  addCollection(viewerId, VIEWER_COLLECTION_TITLE, [viewerId, friend(0).id, friend(1).id, friend(2).id], 5, 20);
  addCollection(friend(1).id, COLLECTION_TITLES[0]!, [friend(1).id, viewerId, friend(3).id], 3, 11);

  return { lists, listItems, plans, planParticipants, planExpenses, votes, voteOptions, voteParticipants, voteBallots, weGroups, weGroupMembers, weGroupItems, gatherings, gatheringInvitees, microEvents, microEventParticipants, subscriptions, bookings, checkIns, reviews, participations, feedPosts, collections, collectionMembers, collectionItems };
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
  const c = DEMO_COUNTS[config.scale];

  // users + profiles (users[0] and users[1] double as organizers)
  const users: UserEntity[] = [];
  for (let i = 0; i < c.users; i += 1) {
    const createdAt = shiftDays(now, -int(30, 120), int(9, 22));
    users.push({
      id: uuid(),
      maxUserId: String(DEMO_USER_ID_BASE + i),
      firstName: fakerRU.person.firstName(),
      lastName: fakerRU.person.lastName(),
      username: i % 3 === 0 ? fakerRU.internet.username() : null,
      avatarUrl: i % 2 === 1 ? picsum(`demo-user-${i}`) : null,
      bannedFromPublishing: false,
      friendsSyncedAt: null,
      createdAt,
      updatedAt: createdAt,
    });
  }
  const organizers = [users[0]!, users[1]!];

  const profiles: ProfileEntity[] = users.map((user, i) => ({
    userId: user.id,
    city: i % 8 === 6 ? "Санкт-Петербург" : DEMO_CITY,
    interests: pickInterests(),
    smartAlerts: DEFAULT_SMART_ALERTS,
    privacy: DEFAULT_PRIVACY,
    recommendationsEnabled: chance(0.9),
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
      friendships.push({ id: uuid(), userId, friendUserId, createdAt, updatedAt: createdAt });
    }
  };
  users.forEach((user, i) => {
    if (i % 2 === 1) addFriendship(ownerUserId, user.id);
    if (i % 3 === 0) addFriendship(devUserId, user.id);
  });

  // places
  const places: PlaceEntity[] = [];
  for (let i = 0; i < c.places; i += 1) {
    const base = PLACE_POOL[i % PLACE_POOL.length]!;
    const repeat = Math.floor(i / PLACE_POOL.length);
    const createdAt = shiftDays(now, -int(60, 200), 12);
    places.push({
      id: uuid(),
      title: repeat === 0 ? base.title : `${base.title} №${repeat + 1}`,
      address: base.address,
      city: DEMO_CITY,
      category: base.category,
      latitude: base.latitude + repeat * 0.003,
      longitude: base.longitude,
      organizerUserId: i < 6 ? organizers[i % 2].id : null,
      published: true,
      createdAt,
      updatedAt: shiftDays(now, -int(1, 30), 12),
    });
  }

  // events: i < 10 belong to the two organizers, i < 20 to random users; 40% are in the past
  const events: EventEntity[] = [];
  for (let i = 0; i < c.events; i += 1) {
    const category = EVENT_CATEGORIES[i % EVENT_CATEGORIES.length]!;
    const place = chance(0.7) ? pick(places) : null;
    const past = i % 5 < 2;
    const dayOffset = past ? -int(1, 7) : int(1, 30);
    const startsAt = shiftDays(now, dayOffset, int(10, 20));
    const isPaid = i < 10 ? i % 2 === 0 : chance(0.4);
    const capacity = chance(0.5) ? int(20, 200) : null;
    const organizerUserId = i < 10 ? organizers[i % 2].id : i < 20 ? pick(users).id : null;
    const createdAt = new Date(startsAt.getTime() - int(3, 21) * 24 * HOUR_MS);
    events.push({
      id: uuid(),
      title: pick(EVENT_TITLES[category]),
      description: pick(EVENT_DESCRIPTIONS),
      category,
      city: place?.city ?? DEMO_CITY,
      placeId: place?.id ?? null,
      organizerUserId,
      startsAt,
      endsAt: chance(0.75) ? new Date(startsAt.getTime() + int(1, 3) * HOUR_MS) : null,
      isPaid,
      priceRub: isPaid ? int(6, 60) * 50 : null,
      paymentUrl: isPaid ? `https://demo-pay.max-events.local/event-${i}` : null,
      capacity,
      bookedCount: capacity !== null ? int(0, Math.floor(capacity * 0.6)) : int(0, 40),
      published: true,
      bookingOpensAt: null,
      chatLink: null,
      chatSyncPending: true,
      createdAt,
      updatedAt: createdAt,
    });
  }
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
  for (let attempt = 0; bookings.length < c.bookings && attempt < c.bookings * 50; attempt += 1) {
    const user = pick(users);
    const event = pick(futureEvents);
    const key = `${user.id}:${event.id}`;
    if (bookingPairs.has(key)) continue;
    bookingPairs.add(key);
    const createdAt = shiftDays(now, -int(1, 5), int(10, 20));
    bookings.push({
      id: uuid(),
      userId: user.id,
      eventId: event.id,
      status: (bookings.length < c.bookings - 5 ? "active" : "cancelled") as BookingStatus,
      promoCode: promoEventId !== null && event.id === promoEventId && chance(0.4) ? "DEMO20" : null,
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

  // stories + feed posts
  const stories: StoryEntity[] = Array.from({ length: c.stories }, (_, i) => ({
    id: uuid(),
    userId: pick(users).id,
    imageUrl: picsum(`demo-story-${i}`),
    createdAt: new Date(now.getTime() - int(1, 20) * HOUR_MS),
  }));
  const feedPosts: FeedPostEntity[] = Array.from({ length: c.feedPosts }, (_, i) => ({
    id: uuid(),
    authorUserId: pick(users).id,
    eventId: pick(events).id,
    text: pick(FEED_TEXTS),
    photoUrl: chance(0.7) ? picsum(`demo-post-${i}`) : null,
    published: true,
    createdAt: new Date(now.getTime() - int(1, 168) * HOUR_MS),
  }));

  // reviews on past events, unique user+event pairs
  const reviews: ReviewEntity[] = [];
  const reviewPairs = new Set<string>();
  for (let attempt = 0; reviews.length < c.reviews && attempt < c.reviews * 50 && pastEvents.length > 0; attempt += 1) {
    const user = pick(users);
    const event = pick(pastEvents);
    const key = `${user.id}:${event.id}`;
    if (reviewPairs.has(key)) continue;
    reviewPairs.add(key);
    reviews.push({
      id: uuid(),
      userId: user.id,
      eventId: event.id,
      stars: int(3, 5),
      categoryScores: { atmosphere: int(3, 5), organization: int(3, 5), price: int(3, 5), place: int(3, 5) },
      wouldGoAgain: chance(0.8),
      photoUrls: chance(0.3) ? [picsum(`demo-review-${reviews.length}`)] : [],
      text: chance(0.6) ? pick(REVIEW_TEXTS) : null,
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

  // lists: the six preset lists of the demo owner
  const lists: ListEntity[] = ListPresetSchema.options.map((preset: ListPreset) => ({
    id: uuid(),
    userId: ownerUserId,
    preset,
    title: LIST_PRESET_TITLES[preset],
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
    const usePlace = chance(0.5);
    const participantIds = new Set<string>();
    if (i % 5 < 3) {
      fakerRU.helpers.arrayElements(users, Math.min(4, users.length)).forEach((user) => {
        if (user.id !== author.id) participantIds.add(user.id);
      });
    }
    microEvents.push({
      id: microEventId,
      authorId: author.id,
      title: MICRO_EVENT_TITLES[i % MICRO_EVENT_TITLES.length]!,
      startsAt: shiftDays(now, int(1, 14), int(10, 20)),
      locationText: usePlace ? null : pick(MICRO_LOCATIONS),
      placeId: usePlace ? pick(places).id : null,
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

  // Зритель — тот, кто реально вошёл на стенд. Его срез строится последним: он опирается на уже
  // сгенерированных людей, площадки и события, и без него личные экраны показывают пустоту.
  const viewer = buildViewerSlice({ now, viewerId: devUserId, users, organizers, places, pastEvents, futureEvents });
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
    const userId = attempt % 6 === 0 ? devUserId : pick(users).id;
    const key = `${post.id}:${userId}`;
    if (likePairs.has(key)) continue;
    likePairs.add(key);
    feedLikes.push({ id: uuid(), postId: post.id, userId });
  }
  const feedComments: FeedCommentEntity[] = Array.from({ length: c.feedComments }, (_, i) => {
    const post = pick(feedPosts);
    return { id: uuid(), postId: post.id, authorUserId: i % 5 === 0 ? devUserId : pick(users).id, text: pick(COMMENT_TEXTS), createdAt: new Date(Math.min(now.getTime() - 60_000, post.createdAt.getTime() + int(1, 40) * HOUR_MS)) };
  });

  // Коллекции: к двум подборкам зрителя добавляются чужие, чтобы домен не состоял из него одного.
  const collections: CollectionEntity[] = [...viewer.collections];
  const collectionMembers: CollectionMemberEntity[] = [...viewer.collectionMembers];
  const collectionItems: CollectionItemEntity[] = [...viewer.collectionItems];
  for (let i = 0; i < c.collections; i += 1) {
    const owner = pick(users);
    const collectionId = uuid();
    const createdAt = shiftDays(now, -int(5, 40), 12);
    collections.push({ id: collectionId, ownerUserId: owner.id, title: COLLECTION_TITLES[(i + 1) % COLLECTION_TITLES.length]!, chatLink: null, createdAt, updatedAt: createdAt });
    const memberIds = new Set<string>([owner.id]);
    fakerRU.helpers.arrayElements(users, Math.min(4, users.length)).forEach((user) => memberIds.add(user.id));
    const members = [...memberIds];
    members.forEach((userId) => collectionMembers.push({ id: uuid(), collectionId, userId }));
    fakerRU.helpers.arrayElements(events, Math.min(4, events.length)).forEach((event, k) => collectionItems.push({ id: uuid(), collectionId, eventId: event.id, section: COLLECTION_SECTIONS[k % COLLECTION_SECTIONS.length]!, addedByUserId: members[k % members.length]!, addedAt: shiftDays(now, -int(1, 20), 12) }));
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
  if (queueEvent) {
    const createdAt = shiftDays(now, -3, 14);
    waitlistEntries.push({ id: uuid(), userId: devUserId, eventId: queueEvent.id, status: "waiting" as WaitlistStatus, offeredUntil: null, referralCode: null, createdAt, updatedAt: createdAt });
  }
  const offerEvent = waitlistEvents[1];
  if (offerEvent) {
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
    const userId = attempt % 4 === 0 ? devUserId : pick(users).id;
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
    collections,
    collectionMembers,
    collectionItems,
    waitlistEntries,
    userAchievements,
    reports,
    payments,
    promoFulfillments,
  };
}

// --- Database insertion ------------------------------------------------------

export type DemoSeedOptions = {
  scale: DemoScale;
  ownerMaxUserId: string;
  devMaxUserId: string;
  now?: Date;
};

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
  return repo.save(repo.create({ maxUserId, ...seed, avatarUrl: null, bannedFromPublishing: false }));
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

function remapPlaceIds(data: DemoData, idMap: Map<string, string>): void {
  const real = (id: string | null): string | null => (id === null ? null : (idMap.get(id) ?? id));
  for (const event of data.events) event.placeId = real(event.placeId);
  for (const checkIn of data.checkIns) checkIn.placeId = real(checkIn.placeId);
  for (const item of data.listItems) item.placeId = real(item.placeId);
  for (const item of data.weGroupItems) item.placeId = real(item.placeId);
  for (const subscription of data.subscriptions) subscription.placeId = real(subscription.placeId);
  for (const microEvent of data.microEvents) microEvent.placeId = real(microEvent.placeId);
  // У жалобы нет внешнего ключа на площадку, но очередь модерации всё равно должна открывать живую
  // карточку, а не идентификатор, которого в базе нет.
  for (const report of data.reports) {
    if (report.targetType === "place") report.targetId = real(report.targetId) ?? report.targetId;
  }
}

export async function seedDemoDatabase(dataSource: DataSource, options: DemoSeedOptions): Promise<DemoSeedResult> {
  const now = options.now ?? new Date();
  const usersRepo = dataSource.getRepository(UserEntity);
  const owner = await ensureDemoUser(usersRepo, options.ownerMaxUserId, { firstName: "Smoke", lastName: "Runner", username: "max_events_smoke" });
  const dev = await ensureDemoUser(usersRepo, options.devMaxUserId, { firstName: "Михаил", lastName: null, username: "seaG7" });
  const data = buildDemoData({ now, scale: options.scale, ownerUserId: owner.id, devUserId: dev.id });

  // Люди идут первыми: у площадки есть organizerUserId со внешним ключом на users, и на пустой базе
  // вставка площадок до людей падает по FK_places_organizer. Раньше порядок сходил с рук только
  // потому, что на обжитой базе площадки находились уже существующими и не вставлялись вовсе.
  const inserted: Record<string, number> = {};
  inserted.users = await insertRows(usersRepo, data.users);
  inserted.profiles = await insertRows(dataSource.getRepository(ProfileEntity), data.profiles);
  inserted.friendships = await insertRows(dataSource.getRepository(FriendshipEntity), data.friendships);

  const places = await resolveRows(dataSource.getRepository(PlaceEntity), data.places, (place) => ({ title: place.title, address: place.address, city: place.city }));
  remapPlaceIds(data, places.idMap);
  // Пресет узнаётся по (userId, preset), собственный список пресета не имеет — его различает заголовок.
  const lists = await resolveRows(dataSource.getRepository(ListEntity), data.lists, (list) => (list.preset === null ? { userId: list.userId, title: list.title } : { userId: list.userId, preset: list.preset }));
  for (const item of data.listItems) item.listId = lists.idMap.get(item.listId) ?? item.listId;

  inserted.places = places.inserted;
  inserted.events = await insertRows(dataSource.getRepository(EventEntity), data.events);
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
  inserted.gatherings = await insertRows(dataSource.getRepository(GatheringEntity), data.gatherings);
  inserted.gatheringInvitees = await insertRows(dataSource.getRepository(GatheringInviteeEntity), data.gatheringInvitees);
  inserted.microEvents = await insertRows(dataSource.getRepository(MicroEventEntity), data.microEvents);
  inserted.microEventParticipants = await insertRows(dataSource.getRepository(MicroEventParticipantEntity), data.microEventParticipants);
  inserted.plans = await insertRows(dataSource.getRepository(PlanEntity), data.plans);
  inserted.planParticipants = await insertRows(dataSource.getRepository(PlanParticipantEntity), data.planParticipants);
  inserted.planExpenses = await insertRows(dataSource.getRepository(PlanExpenseEntity), data.planExpenses);
  inserted.collections = await insertRows(dataSource.getRepository(CollectionEntity), data.collections);
  inserted.collectionMembers = await insertRows(dataSource.getRepository(CollectionMemberEntity), data.collectionMembers);
  inserted.collectionItems = await insertRows(dataSource.getRepository(CollectionItemEntity), data.collectionItems);

  const totalRows = Object.values(data).reduce((sum, rows) => sum + rows.length, 0);
  const totalInserted = Object.values(inserted).reduce((sum, count) => sum + count, 0);
  return { inserted, totalRows, totalInserted, totalSkipped: totalRows - totalInserted };
}
