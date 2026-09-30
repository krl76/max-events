// START_MODULE_CONTRACT
// PURPOSE: Curated people, captions, stories and cabinet events for the demo seed — identities stay
//   consistent (name, sex, voice, avatar, the photos they actually took).
// SCOPE: DEMO_CAST, place logos, authored feed/stories/comments/reviews, viewer walks, organizer showcase.
// DEPENDS: @max-events/api-contracts (EventCategory)
// LINKS: M-SVC-BACKEND
// END_MODULE_MAP

import type { CityWalk, EventCategory, WalkInterest } from "@max-events/api-contracts";

export type DemoSex = "female" | "male";

export type DemoCastPerson = {
  slug: string;
  firstName: string;
  lastName: string;
  username: string;
  sex: DemoSex;
  city: string;
  bio: string;
  interests: string[];
  avatarUrl: string;
};

export const DEMO_CAST: readonly DemoCastPerson[] = [
  { slug: "anya", firstName: "Аня", lastName: "Козлова", username: "anya_kzl", sex: "female", city: "Москва", bio: "Йога по утрам и длинные прогулки. Пишу редко.", interests: ["Спорт", "Фотография", "Путешествия"], avatarUrl: "/covers/people/anya.jpg" },
  { slug: "katya", firstName: "Катя", lastName: "Лебедева", username: "katya.leb", sex: "female", city: "Москва", bio: "Музеи, кофе, иногда лекции. Ищу компанию на выходные.", interests: ["Искусство", "Лекции", "Гастрономия"], avatarUrl: "/covers/people/katya.jpg" },
  { slug: "marina", firstName: "Марина", lastName: "Орлова", username: "m.orlova", sex: "female", city: "Москва", bio: "Парки юга Москвы. Царицыно — любимое место.", interests: ["Путешествия", "Фотография", "Искусство"], avatarUrl: "/covers/people/marina.jpg" },
  { slug: "dasha", firstName: "Даша", lastName: "Новикова", username: "dasha.nov", sex: "female", city: "Москва", bio: "Книги и Третьяковка. По выходным хожу смотреть картины.", interests: ["Искусство", "Лекции", "Кино"], avatarUrl: "/covers/people/dasha.jpg" },
  { slug: "yulya", firstName: "Юля", lastName: "Соколова", username: "yu.sokol", sex: "female", city: "Москва", bio: "Дворы и маршруты. Люблю ходить без плана.", interests: ["Путешествия", "Фотография", "Кино"], avatarUrl: "/covers/people/yulya.jpg" },
  { slug: "nastya", firstName: "Настя", lastName: "Морозова", username: "nastya.mrz", sex: "female", city: "Москва", bio: "Концерты в маленьких залах. Гитара > сцена.", interests: ["Музыка", "Театр", "Гастрономия"], avatarUrl: "/covers/people/nastya.jpg" },
  { slug: "ira", firstName: "Ира", lastName: "Белова", username: "ira.belova", sex: "female", city: "Москва", bio: "Парки и тихие вечера. Не люблю толпу.", interests: ["Музыка", "Искусство", "Путешествия"], avatarUrl: "/covers/people/ira.jpg" },
  { slug: "lena", firstName: "Лена", lastName: "Крылова", username: "lena.kryl", sex: "female", city: "Москва", bio: "Английский за кофе и долгие разговоры.", interests: ["Лекции", "Гастрономия", "Настольные игры"], avatarUrl: "/covers/people/lena.jpg" },
  { slug: "sveta", firstName: "Света", lastName: "Панова", username: "sveta.pan", sex: "female", city: "Санкт-Петербург", bio: "В Москве наездами. Зарядье — первое, куда иду.", interests: ["Путешествия", "Фотография", "Кино"], avatarUrl: "/covers/people/sveta.jpg" },
  { slug: "olya", firstName: "Оля", lastName: "Фролова", username: "olya.fro", sex: "female", city: "Москва", bio: "Музеи и керамика. Руки любят глину.", interests: ["Искусство", "Лекции", "Гастрономия"], avatarUrl: "/covers/people/olya.jpg" },
  { slug: "dima", firstName: "Дима", lastName: "Соколов", username: "dima.skl", sex: "male", city: "Москва", bio: "Утром парк, вечером джаз. Пишу коротко.", interests: ["Спорт", "Музыка", "Фотография"], avatarUrl: "/covers/people/dima.jpg" },
  { slug: "artem", firstName: "Артём", lastName: "Волков", username: "artyom.volk", sex: "male", city: "Москва", bio: "Вело и набережные. Темп спокойный.", interests: ["Спорт", "Бег", "Путешествия"], avatarUrl: "/covers/people/artem.jpg" },
  { slug: "pasha", firstName: "Паша", lastName: "Кузнецов", username: "pasha.kuz", sex: "male", city: "Москва", bio: "Бег в Сокольниках. 5 км — мой комфорт.", interests: ["Бег", "Спорт", "Волонтёрство"], avatarUrl: "/covers/people/pasha.jpg" },
  { slug: "nikita", firstName: "Никита", lastName: "Орлов", username: "nik.orlov", sex: "male", city: "Москва", bio: "Лекции и книжный клуб. Можно не дочитывать.", interests: ["Лекции", "Искусство", "Кино"], avatarUrl: "/covers/people/nikita.jpg" },
  { slug: "serezha", firstName: "Серёжа", lastName: "Белов", username: "sereja.bel", sex: "male", city: "Москва", bio: "Субботники и простые дела. Приду на час.", interests: ["Волонтёрство", "Спорт", "Настольные игры"], avatarUrl: "/covers/people/serezha.jpg" },
  { slug: "maxim", firstName: "Максим", lastName: "Петров", username: "max.ptrv", sex: "male", city: "Москва", bio: "Камерные концерты. Сидеть близко — лучшее.", interests: ["Музыка", "Театр", "Гастрономия"], avatarUrl: "/covers/people/maxim.jpg" },
  { slug: "ilya", firstName: "Илья", lastName: "Новиков", username: "ilya.nov", sex: "male", city: "Москва", bio: "Коломенское и длинные дорожки. Наушники не всегда.", interests: ["Путешествия", "Фотография", "Бег"], avatarUrl: "/covers/people/ilya.jpg" },
  { slug: "andrey", firstName: "Андрей", lastName: "Крылов", username: "andrey.krl", sex: "male", city: "Москва", bio: "После работы — парк или лекция. Без спешки.", interests: ["Лекции", "Кино", "Гастрономия"], avatarUrl: "/covers/people/andrey.jpg" },
  { slug: "roma", firstName: "Рома", lastName: "Лебедев", username: "roma.leb", sex: "male", city: "Москва", bio: "Мяч, парк, иногда забег. Компания важнее темпа.", interests: ["Спорт", "Бег", "Настольные игры"], avatarUrl: "/covers/people/roma.jpg" },
  { slug: "kirill", firstName: "Кирилл", lastName: "Морозов", username: "kir.moroz", sex: "male", city: "Москва", bio: "ВДНХ и павильоны. Хожу смотреть, не фотографировать.", interests: ["Путешествия", "Лекции", "Фотография"], avatarUrl: "/covers/people/kirill.jpg" },
];

/** Cover for every venue in the seed pool — profile tiles and place cards read this. */
export const PLACE_LOGOS: Readonly<Record<string, string>> = {
  "Парк Горького": "/onboarding/gorky.jpg",
  Сокольники: "/covers/places/sokolniki.jpg",
  ВДНХ: "/covers/places/vdnh.jpg",
  "Парк «Зарядье»": "/covers/places/zaryadye.jpg",
  Коломенское: "/covers/kolomenskoe.jpg",
  Царицыно: "/covers/visits/tsaritsyno.jpg",
  Кусково: "/covers/places/kuskovo.jpg",
  "Аптекарский огород": "/covers/places/apothecary.jpg",
  "Измайловский парк": "/covers/places/izmailovo.jpg",
  "Парк Победы": "/covers/places/pobedy.jpg",
  "Нескучный сад": "/covers/places/neskuchny.jpg",
  "Третьяковская галерея": "/covers/visits/museum.jpg",
  "ГМИИ им. А.С. Пушкина": "/covers/places/pushkin.jpg",
  "Музей космонавтики": "/covers/places/cosmos.jpg",
  "Дарвиновский музей": "/covers/places/darwin.jpg",
  "Музей «Гараж»": "/covers/places/garage.jpg",
  "Кофейня «Даблби»": "/covers/visits/cafe.jpg",
  "Пекарня «Батон»": "/covers/places/baton.jpg",
  "Кофейня «Сёрф»": "/covers/places/surf.jpg",
  "Антикафе «Циферблат»": "/covers/concert.jpg",
  Лужники: "/covers/places/luzhniki.jpg",
  "СК «Олимпийский»": "/covers/places/olympic.jpg",
  "ВТБ Арена": "/covers/places/vtb.jpg",
  "УСЗ «Москвич»": "/covers/places/moskvich.jpg",
  "ДК «Москва»": "/covers/places/dk.jpg",
  "Кинотеатр «Иллюзион»": "/covers/places/illusion.jpg",
};

export type AuthoredPost = {
  authorSlug: string;
  eventTitle: string | null;
  placeTitle: string | null;
  text: string;
  photoUrl: string;
  locationLabel?: string;
  taggedFriendSlugs?: string[];
  hoursAfterStart?: number;
};

/**
 * One voice per photo. The Tsaritsyno selfie is Марина; the Gorky arch couple is Аня (with Дима
 * in the frame). Captions stay short, as in a messenger, and match the author's sex.
 */
export const AUTHORED_POSTS: readonly AuthoredPost[] = [
  { authorSlug: "anya", eventTitle: "Утренняя йога у арки", placeTitle: "Парк Горького", text: "утром у арки. наконец выбрались вдвоём", photoUrl: "/covers/visits/gorky-me.jpg", locationLabel: "Парк Горького", taggedFriendSlugs: ["dima"], hoursAfterStart: 2 },
  { authorSlug: "marina", eventTitle: "Экскурсия по Царицыну", placeTitle: "Царицыно", text: "Гуляла у пруда в Царицыне, Большой дворец напротив.", photoUrl: "/covers/visits/tsaritsyno-me.jpg", locationLabel: "Царицыно", hoursAfterStart: 3 },
  { authorSlug: "ira", eventTitle: "Джаз в Нескучном саду", placeTitle: "Нескучный сад", text: "сидели у столиков, трио играло без сцены. час пролетел", photoUrl: "/covers/jazz.jpg", locationLabel: "Нескучный сад", hoursAfterStart: 4 },
  { authorSlug: "nastya", eventTitle: "Авторская песня в «Циферблате»", placeTitle: "Антикафе «Циферблат»", text: "гитара на столе, зал маленький. слышно каждое слово", photoUrl: "/covers/concert.jpg", locationLabel: "Циферблат", hoursAfterStart: 3 },
  { authorSlug: "dasha", eventTitle: "Лекция в Третьяковке", placeTitle: "Третьяковская галерея", text: "после лекции осталась у большого полотна. группа была небольшой", photoUrl: "/covers/visits/museum.jpg", locationLabel: "Третьяковка", hoursAfterStart: 2 },
  { authorSlug: "pasha", eventTitle: "Пять километров в Сокольниках", placeTitle: "Сокольники", text: "на главной аллее ещё не отдышался. темп и правда лёгкий", photoUrl: "/covers/visits/run.jpg", locationLabel: "Сокольники", hoursAfterStart: 1 },
  { authorSlug: "serezha", eventTitle: "Субботник в Измайловском парке", placeTitle: "Измайловский парк", text: "мешок собрали вдвоём за час. перчатки выдали на месте", photoUrl: "/covers/visits/cleanup.jpg", locationLabel: "Измайловский парк", taggedFriendSlugs: ["roma"], hoursAfterStart: 2 },
  { authorSlug: "lena", eventTitle: "Разговорный клуб в «Даблби»", placeTitle: "Кофейня «Даблби»", text: "после занятия остались за кофе у окна. стол повезло", photoUrl: "/covers/visits/cafe.jpg", locationLabel: "Даблби на Мясницкой", hoursAfterStart: 2 },
  { authorSlug: "ilya", eventTitle: "Экскурсия по Коломенскому", placeTitle: "Коломенское", text: "в субботу идём к деревянному дворцу. кто с нами?", photoUrl: "/covers/kolomenskoe.jpg", locationLabel: "Коломенское", hoursAfterStart: -20 },
  { authorSlug: "yulya", eventTitle: "Прогулка по дворам Замоскворечья", placeTitle: "Третьяковская галерея", text: "выходим от Третьяковки во дворы. жёлтый дом с зелёной аркой — будет", photoUrl: "/covers/tour.jpg", locationLabel: "Замоскворечье", hoursAfterStart: -12 },
  { authorSlug: "kirill", eventTitle: "Субботник у арки Парка Горького", placeTitle: "Парк Горького", text: "в субботу час у арки. мешки выдают, можно на один час", photoUrl: "/onboarding/gorky.jpg", locationLabel: "Парк Горького", hoursAfterStart: -8 },
  { authorSlug: "maxim", eventTitle: "Камерный вечер в ДК «Москва»", placeTitle: "ДК «Москва»", text: "зал маленький, гитара на расстоянии руки. места лучше занять заранее", photoUrl: "/covers/concert.jpg", locationLabel: "ДК Москва", hoursAfterStart: -6 },
  { authorSlug: "sveta", eventTitle: null, placeTitle: "Парк «Зарядье»", text: "приехала и сразу на мост. город снизу странный", photoUrl: "/covers/places/zaryadye.jpg", locationLabel: "Зарядье" },
  { authorSlug: "kirill", eventTitle: null, placeTitle: "ВДНХ", text: "фонтан ещё работает. павильоны как всегда огромные", photoUrl: "/covers/places/vdnh.jpg", locationLabel: "ВДНХ" },
  { authorSlug: "olya", eventTitle: null, placeTitle: "Музей «Гараж»", text: "зашла на час между делами. зал светлый, людей мало", photoUrl: "/covers/places/garage.jpg", locationLabel: "Гараж" },
  { authorSlug: "andrey", eventTitle: null, placeTitle: "Пекарня «Батон»", text: "взял бородинский и кофе. очередь была, но быстро", photoUrl: "/covers/places/baton.jpg", locationLabel: "Батон на Покровке" },
];

export type AuthoredStory = {
  authorSlug: string;
  imageUrl: string;
  text?: string;
  stickerEventTitle?: string;
  poll?: { question: string; options: string[] };
  hoursAgo: number;
};

export const AUTHORED_STORIES: readonly AuthoredStory[] = [
  { authorSlug: "anya", imageUrl: "/covers/visits/gorky-me.jpg", text: "утро", hoursAgo: 1 },
  { authorSlug: "marina", imageUrl: "/covers/visits/tsaritsyno-me.jpg", text: "царицыно 🍂", stickerEventTitle: "Экскурсия по Царицыну", hoursAgo: 2 },
  { authorSlug: "dasha", imageUrl: "/covers/visits/museum.jpg", hoursAgo: 3 },
  { authorSlug: "ira", imageUrl: "/covers/places/neskuchny.jpg", text: "джаз вечером", stickerEventTitle: "Джаз в Нескучном саду", hoursAgo: 4 },
  { authorSlug: "olya", imageUrl: "/covers/visits/cafe.jpg", poll: { question: "кофе после лекции?", options: ["да", "лучше домой"] }, hoursAgo: 5 },
  { authorSlug: "pasha", imageUrl: "/covers/visits/run.jpg", text: "5 км", stickerEventTitle: "Пять километров в Сокольниках", hoursAgo: 6 },
  { authorSlug: "maxim", imageUrl: "/covers/concert.jpg", hoursAgo: 7 },
  { authorSlug: "roma", imageUrl: "/covers/kolomenskoe.jpg", hoursAgo: 2 },
  { authorSlug: "lena", imageUrl: "/covers/places/surf.jpg", hoursAgo: 3 },
  { authorSlug: "dima", imageUrl: "/covers/jazz.jpg", text: "сегодня", hoursAgo: 4 },
  { authorSlug: "sveta", imageUrl: "/covers/places/zaryadye.jpg", hoursAgo: 5 },
  { authorSlug: "ilya", imageUrl: "/covers/places/kuskovo.jpg", poll: { question: "куда в вс?", options: ["Кусково", "Коломенское", "дома"] }, hoursAgo: 6 },
];

export type AuthoredComment = {
  eventTitle?: string;
  placeTitle?: string;
  authorSlug: string;
  text: string;
};

export const AUTHORED_COMMENTS: readonly AuthoredComment[] = [
  { eventTitle: "Утренняя йога у арки", authorSlug: "katya", text: "милые. во сколько старт был?" },
  { eventTitle: "Утренняя йога у арки", authorSlug: "pasha", text: "в следующий раз приду" },
  { eventTitle: "Утренняя йога у арки", authorSlug: "olya", text: "коврик свой надо?" },
  { eventTitle: "Экскурсия по Царицыну", authorSlug: "anya", text: "красиво там осенью" },
  { eventTitle: "Экскурсия по Царицыну", authorSlug: "dima", text: "мы как раз в субботу собирались" },
  { eventTitle: "Экскурсия по Царицыну", authorSlug: "katya", text: "гид нормальный был?" },
  { eventTitle: "Экскурсия по Царицыну", authorSlug: "ilya", text: "ого дворец" },
  { eventTitle: "Джаз в Нескучном саду", authorSlug: "dima", text: "слышал, что без сцены — так даже лучше" },
  { eventTitle: "Джаз в Нескучном саду", authorSlug: "nastya", text: "в следующий раз пойду" },
  { eventTitle: "Джаз в Нескучном саду", authorSlug: "andrey", text: "стулья занимают кто раньше пришёл?" },
  { eventTitle: "Авторская песня в «Циферблате»", authorSlug: "maxim", text: "зал и правда крошечный. мне зашло" },
  { eventTitle: "Авторская песня в «Циферблате»", authorSlug: "ira", text: "чай на месте брали?" },
  { eventTitle: "Лекция в Третьяковке", authorSlug: "nikita", text: "на какую картину смотрели?" },
  { eventTitle: "Лекция в Третьяковке", authorSlug: "olya", text: "я в ту группу не попала, обидно" },
  { eventTitle: "Лекция в Третьяковке", authorSlug: "katya", text: "в следующий раз запишусь заранее" },
  { eventTitle: "Пять километров в Сокольниках", authorSlug: "roma", text: "темп какой был примерно?" },
  { eventTitle: "Пять километров в Сокольниках", authorSlug: "artem", text: "воду лучше взять, да" },
  { eventTitle: "Пять километров в Сокольниках", authorSlug: "anya", text: "в следующий раз с вами" },
  { eventTitle: "Субботник в Измайловском парке", authorSlug: "roma", text: "час и чай — нормальный формат" },
  { eventTitle: "Субботник в Измайловском парке", authorSlug: "pasha", text: "в субботу у арки тоже идём" },
  { eventTitle: "Разговорный клуб в «Даблби»", authorSlug: "andrey", text: "на Мясницкой тихо достаточно?" },
  { eventTitle: "Разговорный клуб в «Даблби»", authorSlug: "katya", text: "напиток каждый сам берёт?" },
  { eventTitle: "Экскурсия по Коломенскому", authorSlug: "marina", text: "я в" },
  { eventTitle: "Экскурсия по Коломенскому", authorSlug: "yulya", text: "обувь удобная, да. дорожки длинные" },
  { eventTitle: "Прогулка по дворам Замоскворечья", authorSlug: "dasha", text: "зелёную арку знаю, рядом живу" },
  { eventTitle: "Прогулка по дворам Замоскворечья", authorSlug: "nikita", text: "это не залы музея же? билет не нужен?" },
  { eventTitle: "Субботник у арки Парка Горького", authorSlug: "serezha", text: "приду на час" },
  { eventTitle: "Субботник у арки Парка Горького", authorSlug: "anya", text: "мы утром как раз там были" },
  { eventTitle: "Камерный вечер в ДК «Москва»", authorSlug: "nastya", text: "места заранее — это точно" },
  { eventTitle: "Камерный вечер в ДК «Москва»", authorSlug: "ira", text: "два отделения?" },
  { placeTitle: "Парк «Зарядье»", authorSlug: "yulya", text: "мост в ветреный день лучше с шапкой" },
  { placeTitle: "Парк «Зарядье»", authorSlug: "kirill", text: "я туда с ВДНХ иногда хожу пешком почти" },
  { placeTitle: "ВДНХ", authorSlug: "sveta", text: "фонтан ещё работает? надо зайти" },
  { placeTitle: "ВДНХ", authorSlug: "roma", text: "павильоны внутри тоже открыты?" },
  { placeTitle: "Музей «Гараж»", authorSlug: "dasha", text: "зал светлый, да. я люблю туда между парком" },
  { placeTitle: "Пекарня «Батон»", authorSlug: "lena", text: "бородинский там хороший" },
];

export type AuthoredReview = {
  authorSlug: string;
  eventTitle: string;
  stars: 3 | 4 | 5;
  text: string;
  wouldGoAgain: boolean;
  photoUrl: string;
};

export const AUTHORED_REVIEWS: readonly AuthoredReview[] = [
  { authorSlug: "anya", eventTitle: "Утренняя йога у арки", stars: 5, text: "В Парке Горького удобно: арка видна сразу, на лужайке хватило места всем коврикам.", wouldGoAgain: true, photoUrl: "/covers/visits/gorky-me.jpg" },
  { authorSlug: "marina", eventTitle: "Экскурсия по Царицыну", stars: 5, text: "Гид держал группу у пруда, дворец всё время был в кадре. Никуда не бежали.", wouldGoAgain: true, photoUrl: "/covers/visits/tsaritsyno-me.jpg" },
  { authorSlug: "ira", eventTitle: "Джаз в Нескучном саду", stars: 4, text: "Трио было близко, без сцены и без опоздания. Час пролетел незаметно.", wouldGoAgain: true, photoUrl: "/covers/jazz.jpg" },
  { authorSlug: "nastya", eventTitle: "Авторская песня в «Циферблате»", stars: 5, text: "Слышно каждое слово, зал маленький. Начало ровно в заявленное время.", wouldGoAgain: true, photoUrl: "/covers/concert.jpg" },
  { authorSlug: "dasha", eventTitle: "Лекция в Третьяковке", stars: 4, text: "Группа была небольшой, у картины удалось постоять, а не только пройти мимо.", wouldGoAgain: true, photoUrl: "/covers/visits/museum.jpg" },
  { authorSlug: "pasha", eventTitle: "Пять километров в Сокольниках", stars: 4, text: "Трасса ровная, темп и правда лёгкий. Воду лучше взять с собой.", wouldGoAgain: true, photoUrl: "/covers/visits/run.jpg" },
  { authorSlug: "serezha", eventTitle: "Субботник в Измайловском парке", stars: 5, text: "Всё просто: перчатки, мешок, час работы и чай.", wouldGoAgain: true, photoUrl: "/covers/visits/cleanup.jpg" },
  { authorSlug: "lena", eventTitle: "Разговорный клуб в «Даблби»", stars: 4, text: "Тихо достаточно, чтобы слышать друг друга. Стол у окна — удача.", wouldGoAgain: true, photoUrl: "/covers/visits/cafe.jpg" },
];

export const WE_GROUP_TITLES = ["Мы: парки по выходным", "Мы: вело по набережной", "Мы: музейные субботы", "Мы: кофе и лекции", "Мы: субботники вдвоём"] as const;

export type WalkStopDraft = {
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  description: string;
  placeTitle: string;
};

export type WalkDraft = {
  city: string;
  durationMinutes: number;
  budgetMode: CityWalk["budgetMode"];
  budgetRub: number | null;
  interests: WalkInterest[];
  sourceLabel: CityWalk["sourceLabel"];
  fitted: boolean;
  stops: WalkStopDraft[];
  legs: CityWalk["legs"];
};

export const VIEWER_WALKS: readonly WalkDraft[] = [
  {
    city: "Москва",
    durationMinutes: 150,
    budgetMode: "free",
    budgetRub: null,
    interests: ["parks", "iconic"],
    sourceLabel: "catalog",
    fitted: true,
    stops: [
      { title: "Парк Горького", address: "ул. Крымский Вал, 9", latitude: 55.7297, longitude: 37.6014, description: "Вход у арки, дальше по набережной к Нескучному.", placeTitle: "Парк Горького" },
      { title: "Нескучный сад", address: "Ленинский пр-т, 30", latitude: 55.7143, longitude: 37.5905, description: "Тихие дорожки у реки, без аттракционов.", placeTitle: "Нескучный сад" },
      { title: "Кофейня «Даблби»", address: "ул. Мясницкая, 24", latitude: 55.7645, longitude: 37.6353, description: "Кофе в конце маршрута, если ещё есть силы доехать.", placeTitle: "Кофейня «Даблби»" },
    ],
    legs: [
      { fromTitle: "Парк Горького", toTitle: "Нескучный сад", travelMinutes: 18, distanceKm: 1.4, mode: "walk", transfers: 0, priceRub: null },
      { fromTitle: "Нескучный сад", toTitle: "Кофейня «Даблби»", travelMinutes: 22, distanceKm: 4.8, mode: "metro", transfers: 1, priceRub: 70 },
    ],
  },
  {
    city: "Москва",
    durationMinutes: 180,
    budgetMode: "any",
    budgetRub: null,
    interests: ["history", "parks"],
    sourceLabel: "catalog",
    fitted: true,
    stops: [
      { title: "Царицыно", address: "ул. Дольская, 1", latitude: 55.6156, longitude: 37.6824, description: "Пруд и Большой дворец, без билета в палаты.", placeTitle: "Царицыно" },
      { title: "Коломенское", address: "пр-т Андропова, 39", latitude: 55.6675, longitude: 37.671, description: "Деревянный дворец и церковь, дорожки длинные.", placeTitle: "Коломенское" },
    ],
    legs: [{ fromTitle: "Царицыно", toTitle: "Коломенское", travelMinutes: 28, distanceKm: 6.2, mode: "metro", transfers: 0, priceRub: 70 }],
  },
  {
    city: "Москва",
    durationMinutes: 120,
    budgetMode: "custom",
    budgetRub: 1500,
    interests: ["cultural", "architecture"],
    sourceLabel: "catalog",
    fitted: true,
    stops: [
      { title: "Третьяковская галерея", address: "Лаврушинский пер., 10", latitude: 55.7415, longitude: 37.6208, description: "Час в залах, потом пешком к Пушкинскому.", placeTitle: "Третьяковская галерея" },
      { title: "ГМИИ им. А.С. Пушкина", address: "ул. Волхонка, 12", latitude: 55.7447, longitude: 37.605, description: "Колоннада и один зал — без спешки.", placeTitle: "ГМИИ им. А.С. Пушкина" },
      { title: "Парк «Зарядье»", address: "ул. Варварка, 6с1", latitude: 55.752, longitude: 37.6232, description: "Мост и вид на реку в конце дня.", placeTitle: "Парк «Зарядье»" },
    ],
    legs: [
      { fromTitle: "Третьяковская галерея", toTitle: "ГМИИ им. А.С. Пушкина", travelMinutes: 16, distanceKm: 1.2, mode: "walk", transfers: 0, priceRub: null },
      { fromTitle: "ГМИИ им. А.С. Пушкина", toTitle: "Парк «Зарядье»", travelMinutes: 14, distanceKm: 1.1, mode: "walk", transfers: 0, priceRub: null },
    ],
  },
];

export type OrganizerShowcaseSpec = {
  title: string;
  description: string;
  category: EventCategory;
  place: string;
  cover: string;
  paid: boolean;
  price: number | null;
  paymentUrl: string | null;
  capacity: number | null;
  dayOffset: number;
  hourUtc: number;
  durationHours: number;
};

/** Cabinet catalog: mix of past (reviews, fill) and upcoming, bound to real venues. */
export const ORGANIZER_SHOWCASE: readonly OrganizerShowcaseSpec[] = [
  { title: "Вечер джаза на Патриарших", description: "Живая музыка на открытой веранде. Вход свободный, стулья занимают кто пришёл раньше.", category: "afisha", place: "Нескучный сад", cover: "/covers/jazz.jpg", paid: false, price: null, paymentUrl: null, capacity: 80, dayOffset: -12, hourUtc: 16, durationHours: 3 },
  { title: "Ночной забег по набережной", description: "Пять километров вдоль Москвы-реки, старт у парка Горького.", category: "sport", place: "Парк Горького", cover: "/covers/run.jpg", paid: false, price: null, paymentUrl: null, capacity: 200, dayOffset: -9, hourUtc: 18, durationHours: 2 },
  { title: "Экскурсия по Замоскворечью", description: "Пешая прогулка по дворам и палатам. Билет на сайте организатора.", category: "tourism", place: "Третьяковская галерея", cover: "/covers/tour.jpg", paid: true, price: 900, paymentUrl: "https://pay.example.com/zamoskvorechie", capacity: 25, dayOffset: -6, hourUtc: 9, durationHours: 2 },
  { title: "Субботник в парке Горького", description: "Перчатки и мешки выдаём на месте. Можно прийти на час.", category: "volunteering", place: "Парк Горького", cover: "/covers/cleanup.jpg", paid: false, price: null, paymentUrl: null, capacity: 60, dayOffset: -4, hourUtc: 8, durationHours: 3 },
  { title: "Выставка молодой графики", description: "Один зал, работы этого года. Билет на сайте организатора.", category: "afisha", place: "Музей «Гараж»", cover: "/covers/graphics.jpg", paid: true, price: 500, paymentUrl: "https://pay.example.com/grafika", capacity: 40, dayOffset: -2, hourUtc: 13, durationHours: 4 },
  { title: "Йога на Воробьёвых горах", description: "Коврик с собой. Занятие на смотровой, если нет дождя.", category: "sport", place: "Парк Горького", cover: "/covers/yoga.jpg", paid: false, price: null, paymentUrl: null, capacity: 30, dayOffset: 2, hourUtc: 6, durationHours: 1 },
  { title: "Лекция о городе", description: "Как менялась Москва за последние сто лет. Вопросы в конце.", category: "afisha", place: "Третьяковская галерея", cover: "/covers/lecture.jpg", paid: false, price: null, paymentUrl: null, capacity: 100, dayOffset: 4, hourUtc: 16, durationHours: 2 },
  { title: "Велопрогулка по Яузе", description: "Маршрут двадцать километров, темп спокойный. Велосипед свой.", category: "sport", place: "Сокольники", cover: "/covers/bike.jpg", paid: false, price: null, paymentUrl: null, capacity: 20, dayOffset: 6, hourUtc: 8, durationHours: 3 },
  { title: "Мастерская керамики", description: "Лепим чашку и забираем после обжига. Место по предоплате.", category: "afisha", place: "Антикафе «Циферблат»", cover: "/covers/ceramic.jpg", paid: true, price: 1500, paymentUrl: "https://pay.example.com/keramika", capacity: 12, dayOffset: 8, hourUtc: 12, durationHours: 3 },
  { title: "Поход в Коломенское", description: "Парк, церковь и шашлык не обещаем. Встреча у входа.", category: "tourism", place: "Коломенское", cover: "/covers/kolomenskoe.jpg", paid: false, price: null, paymentUrl: null, capacity: 35, dayOffset: 10, hourUtc: 10, durationHours: 3 },
  { title: "Концерт во дворе", description: "Акустика, два сета. Билет на сайте организатора.", category: "afisha", place: "ДК «Москва»", cover: "/covers/concert.jpg", paid: true, price: 700, paymentUrl: "https://pay.example.com/dvor", capacity: 50, dayOffset: 12, hourUtc: 15, durationHours: 2 },
  { title: "Сбор корма для приюта", description: "Приносите сухой корм. Список нужного — в описании на месте.", category: "volunteering", place: "Измайловский парк", cover: "/covers/shelter.jpg", paid: false, price: null, paymentUrl: null, capacity: null, dayOffset: 14, hourUtc: 9, durationHours: 4 },
  { title: "Турнир по настольному теннису", description: "Парный разряд, ракетки выдаём. Уровень любой.", category: "sport", place: "УСЗ «Москвич»", cover: "/covers/pingpong.jpg", paid: false, price: null, paymentUrl: null, capacity: 16, dayOffset: 16, hourUtc: 14, durationHours: 3 },
  { title: "Рассвет на Воробьёвых", description: "Встречаемся затемно и смотрим, как встаёт город.", category: "tourism", place: "Парк Горького", cover: "/covers/dawn.jpg", paid: false, price: null, paymentUrl: null, capacity: 40, dayOffset: 18, hourUtc: 3, durationHours: 2 },
  { title: "Книжный клуб в библиотеке", description: "Обсуждаем одну книгу. Текст можно не дочитывать.", category: "afisha", place: "Кинотеатр «Иллюзион»", cover: "/covers/books.jpg", paid: false, price: null, paymentUrl: null, capacity: 18, dayOffset: 21, hourUtc: 16, durationHours: 2 },
];

export const ORGANIZER_REVIEW_TEXTS: Readonly<Record<string, string>> = {
  "Вечер джаза на Патриарших": "Играли близко, без сцены. Час пролетел, стулья лучше занять заранее.",
  "Ночной забег по набережной": "Темп спокойный, вдоль реки красиво. Воду лучше взять с собой.",
  "Экскурсия по Замоскворечью": "Дворы тихие, маршрут понятный. Зелёная арка на месте.",
  "Субботник в парке Горького": "Перчатки выдали, час прошёл быстро. Площадь стала заметно чище.",
  "Выставка молодой графики": "Один зал, работы этого года. Людей мало, смотреть было спокойно.",
};
