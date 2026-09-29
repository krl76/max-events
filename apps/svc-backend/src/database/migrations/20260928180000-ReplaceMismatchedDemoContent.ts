import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * The live catalog was filled by the old demo seed: titles and places were picked apart,
 * covers were often empty (the client then invented a picsum photo), and posts reused
 * a stock caption plus a random picture. Deploy runs migrations, not the seed, so this
 * migration is what removes that rows and writes the twelve matched scenes.
 * KudaGo rows and organizer-cabinet events stay. A second run inserts nothing new.
 */

const SHOWCASE_TITLES = ["Вечер джаза на Патриарших", "Ночной забег по набережной", "Экскурсия по Замоскворечью", "Субботник в парке Горького", "Выставка молодой графики", "Йога на Воробьёвых горах", "Лекция о городе", "Велопрогулка по Яузе", "Мастерская керамики", "Поход в Коломенское", "Концерт во дворе", "Сбор корма для приюта", "Турнир по настольному теннису", "Рассвет на Воробьёвых", "Книжный клуб в библиотеке"] as const;

const JUNK_EVENT_TITLES = [
  "Лекция «Города будущего»",
  "Концерт инди-группы «Сирень»",
  "Вечер авторской песни",
  "Открытый показ документального кино",
  "Литературный вечер в библиотеке",
  "Джазовый вечер",
  "Выставка современного фотоискусства",
  "Кинопоказ под открытым небом",
  "Лекция «Как смотреть на искусство»",
  "Концерт камерного оркестра",
  "Творческая встреча с художником",
  "Вечер настольных игр в антикафе",
  "Субботник в парке",
  "Помощь приюту для животных",
  "Сбор гуманитарной помощи",
  "Эко-патруль у реки",
  "Благоустройство школьного двора",
  "Помощь пожилым соседям",
  "Раздача еды нуждающимся",
  "Выставка-ярмарка добрых дел",
  "Ликвидация незаконных свалок",
  "Помощь конному приюту",
  "Озеленение дворов",
  "Волонтёрский интенсив для новичков",
  "Пешая экскурсия по центру Москвы",
  "Веломаршрут по набережным",
  "Экскурсия в Коломенское",
  "Поход выходного дня",
  "Обзорная экскурсия по Замоскворечью",
  "Ночная фотопрогулка по городу",
  "Экскурсия на ВДНХ",
  "Загородная поездка в усадьбу Абрамцево",
  "Прогулка на кораблике по Москве-реке",
  "Экскурсия «Тайны старых переулков»",
  "Гастрономический тур по Мясницкой",
  "Однодневная поездка в Сергиев Посад",
  "Утренняя йога в парке",
  "Пробежка 5 км с клубом",
  "Открытая тренировка по ОФП",
  "Турнир по настольному теннису",
  "Скандинавская ходьба для начинающих",
  "Велопарад по вечерней Москве",
  "Тренировка по воркауту",
  "Матч любительской лиги по футболу",
  "Соревнования по ориентированию",
  "Кроссфит на открытом воздухе",
  "Плавание в открытом бассейне",
  "Чемпионат по стритболу",
] as const;

const JUNK_EVENT_DESCRIPTIONS = ["Вход по предварительной регистрации, приходите за 15 минут до начала.", "Место сбора — главный вход. Возьмите с собой воду и удобную обувь.", "Программа подойдёт и новичкам, и опытным участникам.", "Организаторы ответят на вопросы после основной части.", "Количество мест ограничено, не опаздывайте.", "С собой можно брать друзей — вход свободный."] as const;

const JUNK_FEED_TEXTS = ["Отличное мероприятие, советую всем!", "Была вчера — восторг!", "Кто идёт? Пишите в чат.", "Собираем компанию на выходные.", "Впечатлений море, обязательно повторим.", "Лучшая суббота за месяц.", "Только вернулись — до сих пор под впечатлением.", "Спасибо организаторам!", "Идём с друзьями, присоединяйтесь.", "Место легко найти, вход свободный."] as const;

const JUNK_REVIEW_TEXTS = ["Всё прошло отлично, вернёмся ещё.", "Организация на высоте.", "Начало задержали на 15 минут, но в целом неплохо.", "Атмосфера супер, народу немного.", "Понравилось, в следующий раз возьму друзей.", "Событие оправдало ожидания."] as const;

const JUNK_MICRO_TITLES = ["Бегаем 5 км в парке", "Ищу компанию на настолки", "Прогулка с фотографом по центру", "Кофе и разговорный английский", "Велопрокат и прогулка по набережной", "Пикник в Зарядье", "Настолки в антикафе", "Утренняя медитация в парке", "Ищу компанию в кино", "Пешая прогулка по Бульварному кольцу", "Зову на утренний забег", "Ищу компанию в музей"] as const;

const PLACES: ReadonlyArray<readonly [string, string, string, number, number]> = [
  ["Парк Горького", "ул. Крымский Вал, 9", "park", 55.7297, 37.6014],
  ["Сокольники", "5-й Лучевой просек, 3", "park", 55.793, 37.6768],
  ["ВДНХ", "пр-т Мира, 119, стр. 1", "park", 55.8263, 37.6377],
  ["Парк «Зарядье»", "ул. Варварка, 6с1", "park", 55.752, 37.6232],
  ["Коломенское", "пр-т Андропова, 39", "park", 55.6675, 37.671],
  ["Царицыно", "ул. Дольская, 1", "park", 55.6156, 37.6824],
  ["Кусково", "ул. Юности, 2", "park", 55.746, 37.819],
  ["Аптекарский огород", "пр-т Мира, 26с1", "park", 55.7786, 37.6327],
  ["Измайловский парк", "ул. Городская, 1", "park", 55.7795, 37.734],
  ["Парк Победы", "площадь Победы, 3", "park", 55.7345, 37.506],
  ["Нескучный сад", "Ленинский пр-т, 30", "park", 55.7143, 37.5905],
  ["Третьяковская галерея", "Лаврушинский пер., 10", "museum", 55.7415, 37.6208],
  ["ГМИИ им. А.С. Пушкина", "ул. Волхонка, 12", "museum", 55.7447, 37.605],
  ["Музей космонавтики", "пр-т Мира, 111", "museum", 55.8225, 37.6393],
  ["Дарвиновский музей", "ул. Вавилова, 57", "museum", 55.6912, 37.576],
  ["Музей «Гараж»", "ул. Крымский Вал, 9с32", "museum", 55.7285, 37.6013],
  ["Кофейня «Даблби»", "ул. Мясницкая, 24", "food", 55.7645, 37.6353],
  ["Пекарня «Батон»", "ул. Покровка, 4", "food", 55.7592, 37.644],
  ["Кофейня «Сёрф»", "Никитский бульвар, 12", "food", 55.756, 37.608],
  ["Антикафе «Циферблат»", "ул. Маросейка, 9с1", "food", 55.7565, 37.637],
  ["Лужники", "ул. Лужники, 24с1", "sport", 55.7158, 37.5536],
  ["СК «Олимпийский»", "Олимпийский пр-т, 16", "sport", 55.7835, 37.54],
  ["ВТБ Арена", "Ходынский б-р, 3", "sport", 55.7886, 37.4402],
  ["УСЗ «Москвич»", "ул. Люблинская, 100с1", "sport", 55.6575, 37.744],
  ["ДК «Москва»", "ул. Ленинская Слобода, 26", "other", 55.7083, 37.664],
  ["Кинотеатр «Иллюзион»", "Котельническая наб., 1/15", "other", 55.747, 37.641],
];

type Scene = {
  title: string;
  category: "afisha" | "volunteering" | "tourism" | "sport";
  place: string;
  description: string;
  cover: string;
  visit: string;
  post: string;
  review: string;
  dayOffset: number;
  hour: string;
  booked: number;
  past: boolean;
};

const SCENES: readonly Scene[] = [
  { title: "Утренняя йога у арки", category: "sport", place: "Парк Горького", description: "Встречаемся у главной арки Парка Горького за десять минут до старта. Коврики свои, занятие на лужайке сразу за воротами.", cover: "/onboarding/gorky.jpg", visit: "/covers/visits/gorky-me.jpg", post: "Встретились у арки Парка Горького и сразу снялись. Йога началась через десять минут.", review: "В Парке Горького удобно: арка видна сразу, на лужайке хватило места всем коврикам.", dayOffset: -6, hour: "09:00", booked: 14, past: true },
  { title: "Экскурсия по Царицыну", category: "tourism", place: "Царицыно", description: "Сбор у Большого дворца Царицына, со стороны пруда. Полтора часа по парку, без спешки и без билета в сам дворец.", cover: "/covers/visits/tsaritsyno.jpg", visit: "/covers/visits/tsaritsyno-me.jpg", post: "Экскурсия по Царицыну. Я у пруда, дворец за спиной — так и хотела снять.", review: "В Царицыне гид держал группу у пруда, дворец всё время был в кадре. Никуда не бежали.", dayOffset: -5, hour: "12:00", booked: 18, past: true },
  { title: "Джаз в Нескучном саду", category: "afisha", place: "Нескучный сад", description: "Трио играет у летней площадки Нескучного сада. Вход свободный, стулья занимают кто пришёл раньше.", cover: "/covers/jazz.jpg", visit: "/covers/jazz.jpg", post: "Джаз в Нескучном саду. Трио играло у столиков, я сняла их почти в упор.", review: "В Нескучном саду трио было близко, без сцены и без опоздания. Час пролетел незаметно.", dayOffset: -4, hour: "19:00", booked: 22, past: true },
  { title: "Авторская песня в «Циферблате»", category: "afisha", place: "Антикафе «Циферблат»", description: "Гитара и несколько песен в зале антикафе «Циферблат» на Маросейке. Чай берём на месте.", cover: "/covers/concert.jpg", visit: "/covers/concert.jpg", post: "Авторская песня в «Циферблате». Гитара на нашем столе, я в кадре с бокалом.", review: "В «Циферблате» слышно каждое слово, зал маленький. Начало ровно в заявленное время.", dayOffset: -3, hour: "19:30", booked: 11, past: true },
  { title: "Лекция в Третьяковке", category: "afisha", place: "Третьяковская галерея", description: "Час в залах Третьяковской галереи на Лаврушинском: как смотреть на большое полотно, не пробегая мимо.", cover: "/covers/visits/museum.jpg", visit: "/covers/visits/museum.jpg", post: "После лекции в Третьяковке осталась в зале. Сняла, как стою у большого полотна.", review: "В Третьяковке группа была небольшой, у картины удалось постоять, а не только пройти мимо.", dayOffset: -3, hour: "18:00", booked: 16, past: true },
  { title: "Пять километров в Сокольниках", category: "sport", place: "Сокольники", description: "Лёгкий темп по главной аллее Сокольников. Сбор у входа со стороны 5-го Лучевого просека.", cover: "/covers/visits/run.jpg", visit: "/covers/visits/run.jpg", post: "Пять километров в Сокольниках. Снялся на аллее, ещё не отдышался.", review: "В Сокольниках трасса ровная, темп и правда лёгкий. Воду лучше взять с собой.", dayOffset: -2, hour: "08:30", booked: 19, past: true },
  { title: "Субботник в Измайловском парке", category: "volunteering", place: "Измайловский парк", description: "Час вдоль дорожек Измайловского парка. Перчатки выдадут на месте, мешки тоже.", cover: "/covers/visits/cleanup.jpg", visit: "/covers/visits/cleanup.jpg", post: "Субботник в Измайловском парке. Мешок собрали вдвоём и сразу сфотографировались.", review: "В Измайловском парке всё организовали просто: перчатки, мешок, час работы и чай.", dayOffset: -2, hour: "11:00", booked: 13, past: true },
  { title: "Разговорный клуб в «Даблби»", category: "afisha", place: "Кофейня «Даблби»", description: "Час английского за столом у окна в «Даблби» на Мясницкой. Напиток каждый берёт сам.", cover: "/covers/visits/cafe.jpg", visit: "/covers/visits/cafe.jpg", post: "После клуба осталась в «Даблби» на Мясницкой. Кофе у окна, я в кадре.", review: "В «Даблби» на Мясницкой было тихо достаточно, чтобы слышать друг друга. Стол у окна — удача.", dayOffset: -1, hour: "17:00", booked: 9, past: true },
  { title: "Экскурсия по Коломенскому", category: "tourism", place: "Коломенское", description: "Сбор у деревянного дворца в Коломенском. Идём к церкви, без захода в платные палаты.", cover: "/covers/kolomenskoe.jpg", visit: "/covers/kolomenskoe.jpg", post: "В Коломенском дошли по дорожке до деревянного дворца и церкви. Сняла именно этот вид.", review: "В Коломенском маршрут короткий и понятный: дворец, дорожка, церковь. Обувь удобная пригодилась.", dayOffset: 5, hour: "13:00", booked: 4, past: false },
  { title: "Прогулка по дворам Замоскворечья", category: "tourism", place: "Третьяковская галерея", description: "Выходим от Третьяковской галереи и час ходим по ближайшим дворам. Это не залы музея, билет не нужен.", cover: "/covers/tour.jpg", visit: "/covers/tour.jpg", post: "Ушли от Третьяковки во дворы Замоскворечья. Жёлтый дом с зелёной аркой — мой кадр с прогулки.", review: "Маршрут от Третьяковки по дворам спокойный, без толпы. Зелёная арка и правда на месте.", dayOffset: 9, hour: "12:00", booked: 6, past: false },
  { title: "Субботник у арки Парка Горького", category: "volunteering", place: "Парк Горького", description: "Собираемся у главной арки Парка Горького. Час на площади перед входом, мешки выдают.", cover: "/onboarding/gorky.jpg", visit: "/covers/visits/gorky-me.jpg", post: "До субботника у арки Парка Горького успели сняться. Площадь перед входом уже наша.", review: "У арки Парка Горького легко найти группу. Час прошёл быстро, площадь стала заметно чище.", dayOffset: 12, hour: "11:00", booked: 7, past: false },
  { title: "Камерный вечер в ДК «Москва»", category: "afisha", place: "ДК «Москва»", description: "Небольшой зал ДК «Москва» на Ленинской Слободе. Гитара и два отделения, без танцпола.", cover: "/covers/concert.jpg", visit: "/covers/concert.jpg", post: "Камерный вечер в ДК «Москва». Сидели близко, гитара была на расстоянии вытянутой руки.", review: "В ДК «Москва» зал маленький, слышно без микрофона на весь крик. Места лучше занять заранее.", dayOffset: 16, hour: "19:00", booked: 8, past: false },
];

const STORY_FRAMES: ReadonlyArray<readonly [string, string]> = [
  ["/covers/visits/gorky-me.jpg", "У главной арки Парка Горького, до йоги десять минут."],
  ["/covers/visits/tsaritsyno-me.jpg", "Царицыно, я у пруда, дворец за спиной."],
  ["/covers/visits/museum.jpg", "Зал Третьяковки после лекции, я у большого полотна."],
  ["/covers/visits/run.jpg", "Аллея в Сокольниках, пять километров позади."],
];

const DEMO_USER_SQL = `"maxUserId" ~ '^700000[0-9]{3}$'`;

function sqlText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlList(values: readonly string[]): string {
  return values.map(sqlText).join(", ");
}

function sceneValues(): string {
  return SCENES.map((scene) => `(${[`${sqlText(scene.title)}::varchar`, `${sqlText(scene.description)}::varchar`, `${sqlText(scene.category)}::varchar`, `${sqlText(scene.place)}::varchar`, `${scene.dayOffset}::int`, `${sqlText(scene.hour)}::varchar`, `${scene.booked}::int`, `${sqlText(scene.cover)}::varchar`, `${sqlText(scene.post)}::varchar`, `${sqlText(scene.visit)}::varchar`, `${sqlText(scene.review)}::varchar`, scene.past ? "true" : "false"].join(", ")})`).join(",\n");
}

function placeValues(): string {
  return PLACES.map(([title, address, category, latitude, longitude]) => `(${sqlText(title)}::varchar, ${sqlText(address)}::varchar, ${sqlText(category)}::varchar, ${latitude}::float8, ${longitude}::float8)`).join(",\n");
}

const SCENE_COLUMNS = `title, description, category, place_title, day_offset, start_time, booked, cover, post, visit, review, past`;

export class ReplaceMismatchedDemoContent20260928180000 implements MigrationInterface {
  name = "ReplaceMismatchedDemoContent20260928180000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const showcase = sqlList(SHOWCASE_TITLES);
    const junkTitles = sqlList(JUNK_EVENT_TITLES);
    const junkDescriptions = sqlList(JUNK_EVENT_DESCRIPTIONS);
    const junkPosts = sqlList(JUNK_FEED_TEXTS);
    const junkReviews = sqlList(JUNK_REVIEW_TEXTS);
    const junkMicros = sqlList(JUNK_MICRO_TITLES);
    const sceneTitles = sqlList(SCENES.map((scene) => scene.title));
    const scenes = sceneValues();
    const keptOrganizer = `NOT (e."title" IN (${showcase}) AND e."organizerOrganizationId" IS NOT NULL)`;

    await queryRunner.query(`
      DELETE FROM "events" AS e
      WHERE e."source" IS DISTINCT FROM 'kudago'
        AND ${keptOrganizer}
        AND e."title" NOT IN (${sceneTitles})
        AND (
          e."title" IN (${junkTitles})
          OR (
            e."organizerOrganizationId" IS NULL
            AND e."description" IN (${junkDescriptions})
          )
          OR (
            e."organizerOrganizationId" IS NULL
            AND EXISTS (
              SELECT 1 FROM "places" AS p
              WHERE p."id" = e."placeId"
                AND p."title" ~ ' №[0-9]+$'
                AND p."source" IS DISTINCT FROM 'kudago'
            )
          )
        )
    `);

    await queryRunner.query(`
      DELETE FROM "feed_posts" AS fp
      WHERE COALESCE(fp."photoUrl", '') ILIKE '%picsum.photos%'
        OR EXISTS (SELECT 1 FROM unnest(fp."photoUrls") AS photo WHERE photo ILIKE '%picsum.photos%')
        OR (
          fp."text" IN (${junkPosts})
          AND EXISTS (
            SELECT 1 FROM "users" AS u
            WHERE u."id" = fp."authorUserId" AND u.${DEMO_USER_SQL}
          )
        )
    `);

    await queryRunner.query(`DELETE FROM "stories" WHERE "imageUrl" ILIKE '%picsum.photos%'`);

    await queryRunner.query(`UPDATE "users" SET "avatarUrl" = NULL WHERE "avatarUrl" ILIKE '%picsum.photos%'`);
    await queryRunner.query(`UPDATE "profiles" SET "coverUrl" = NULL WHERE "coverUrl" ILIKE '%picsum.photos%'`);

    await queryRunner.query(`
      UPDATE "reviews"
      SET "photoUrls" = ARRAY(SELECT photo FROM unnest("photoUrls") AS photo WHERE photo NOT ILIKE '%picsum.photos%')
      WHERE EXISTS (SELECT 1 FROM unnest("photoUrls") AS photo WHERE photo ILIKE '%picsum.photos%')
    `);
    await queryRunner.query(`
      DELETE FROM "reviews" AS r
      USING "users" AS u
      WHERE r."userId" = u."id"
        AND u.${DEMO_USER_SQL}
        AND r."text" IN (${junkReviews})
    `);

    await queryRunner.query(`
      DELETE FROM "micro_events" AS m
      USING "users" AS u
      WHERE m."authorId" = u."id"
        AND u.${DEMO_USER_SQL}
        AND m."title" IN (${junkMicros})
    `);

    await queryRunner.query(`
      UPDATE "feed_posts"
      SET "placeId" = NULL
      WHERE "placeId" IN (
        SELECT "id" FROM "places"
        WHERE "title" ~ ' №[0-9]+$'
          AND "source" IS DISTINCT FROM 'kudago'
      )
    `);
    await queryRunner.query(`
      DELETE FROM "places"
      WHERE "title" ~ ' №[0-9]+$'
        AND "source" IS DISTINCT FROM 'kudago'
    `);

    await queryRunner.query(`
      INSERT INTO "places" ("title", "address", "city", "category", "latitude", "longitude", "published")
      SELECT v.title, v.address, 'Москва', v.category, v.latitude, v.longitude, true
      FROM (VALUES
        ${placeValues()}
      ) AS v(title, address, category, latitude, longitude)
      WHERE NOT EXISTS (
        SELECT 1 FROM "places" AS p
        WHERE p."title" = v.title AND p."city" = 'Москва'
      )
    `);

    await queryRunner.query(`
      UPDATE "events" AS e
      SET "description" = v.description,
          "category" = v.category,
          "coverUrl" = v.cover,
          "placeId" = p.id
      FROM (VALUES
        ${scenes}
      ) AS v(${SCENE_COLUMNS})
      JOIN LATERAL (
        SELECT id FROM "places"
        WHERE "title" = v.place_title AND "city" = 'Москва'
        ORDER BY "createdAt"
        LIMIT 1
      ) AS p ON true
      WHERE e."title" = v.title
        AND e."source" IS DISTINCT FROM 'kudago'
        AND e."organizerOrganizationId" IS NULL
        AND (e."coverUrl" IS NULL OR e."coverUrl" ILIKE '%picsum.photos%')
    `);

    await queryRunner.query(`
      INSERT INTO "events" (
        "title", "description", "category", "city", "placeId",
        "startsAt", "endsAt", "isPaid", "priceRub", "paymentUrl", "capacity",
        "bookedCount", "published", "chatSyncPending", "coverUrl"
      )
      SELECT
        v.title,
        v.description,
        v.category,
        'Москва',
        p.id,
        (((date_trunc('day', (now() AT TIME ZONE 'UTC') + interval '3 hours') + v.start_time::time) - interval '3 hours') AT TIME ZONE 'UTC') + (v.day_offset * interval '1 day'),
        (((date_trunc('day', (now() AT TIME ZONE 'UTC') + interval '3 hours') + v.start_time::time) - interval '3 hours') AT TIME ZONE 'UTC') + (v.day_offset * interval '1 day') + interval '2 hours',
        false,
        NULL::int,
        NULL::varchar,
        40,
        v.booked,
        true,
        false,
        v.cover
      FROM (VALUES
        ${scenes}
      ) AS v(${SCENE_COLUMNS})
      JOIN LATERAL (
        SELECT id FROM "places"
        WHERE "title" = v.place_title AND "city" = 'Москва'
        ORDER BY "createdAt"
        LIMIT 1
      ) AS p ON true
      WHERE NOT EXISTS (
        SELECT 1 FROM "events" AS e
        WHERE e."title" = v.title AND e."source" IS DISTINCT FROM 'kudago'
      )
    `);

    await queryRunner.query(`
      UPDATE "events"
      SET "coverUrl" = CASE "category"
        WHEN 'volunteering' THEN '/covers/visits/cleanup.jpg'
        WHEN 'sport' THEN '/covers/visits/run.jpg'
        WHEN 'tourism' THEN '/covers/kolomenskoe.jpg'
        ELSE '/covers/jazz.jpg'
      END
      WHERE "source" IS DISTINCT FROM 'kudago'
        AND ("coverUrl" IS NULL OR "coverUrl" ILIKE '%picsum.photos%')
    `);

    await queryRunner.query(`
      INSERT INTO "feed_posts" (
        "authorUserId", "eventId", "text", "photoUrl", "photoUrls", "placeId", "locationLabel", "audience", "published", "createdAt"
      )
      SELECT u.id, e.id, v.post, v.visit, ARRAY[v.visit]::text[], e."placeId", p."title", 'city', true, e."startsAt" + interval '2 hours'
      FROM (VALUES
        ${scenes}
      ) AS v(${SCENE_COLUMNS})
      JOIN "events" AS e ON e."title" = v.title AND e."source" IS DISTINCT FROM 'kudago' AND e."organizerOrganizationId" IS NULL AND e."coverUrl" = v.cover
      LEFT JOIN "places" AS p ON p.id = e."placeId"
      JOIN LATERAL (
        SELECT id FROM "users"
        WHERE ${DEMO_USER_SQL}
        ORDER BY "maxUserId"
        LIMIT 1
      ) AS u ON true
      WHERE v.past = true
        AND NOT EXISTS (
          SELECT 1 FROM "feed_posts" AS fp
          WHERE fp."eventId" = e.id AND fp."photoUrl" = v.visit
        )
    `);

    await queryRunner.query(`
      INSERT INTO "reviews" (
        "userId", "eventId", "stars", "categoryScores", "wouldGoAgain", "photoUrls", "text", "factTags", "createdAt"
      )
      SELECT u.id, e.id, 5, '{"atmosphere":5,"organization":5,"place":5}'::jsonb, true, ARRAY[v.visit]::text[], v.review, '{}'::text[], e."startsAt" + interval '3 hours'
      FROM (VALUES
        ${scenes}
      ) AS v(${SCENE_COLUMNS})
      JOIN "events" AS e ON e."title" = v.title AND e."source" IS DISTINCT FROM 'kudago' AND e."organizerOrganizationId" IS NULL AND e."coverUrl" = v.cover
      JOIN LATERAL (
        SELECT id FROM "users"
        WHERE ${DEMO_USER_SQL}
        ORDER BY "maxUserId"
        LIMIT 1
      ) AS u ON true
      WHERE v.past = true
        AND NOT EXISTS (
          SELECT 1 FROM "reviews" AS r
          WHERE r."eventId" = e.id AND r."userId" = u.id
        )
    `);

    const storyValues = STORY_FRAMES.map(([image, caption], index) => `(${index + 1}::int, ${sqlText(image)}::varchar, ${sqlText(caption)}::varchar)`).join(",\n");
    await queryRunner.query(`
      INSERT INTO "stories" ("userId", "imageUrl", "text", "audience", "createdAt")
      SELECT u.id, v.image, v.caption, 'city', now() - (v.ord * interval '1 hour')
      FROM (VALUES
        ${storyValues}
      ) AS v(ord, image, caption)
      JOIN LATERAL (
        SELECT id FROM "users"
        WHERE ${DEMO_USER_SQL}
        ORDER BY "maxUserId"
        LIMIT 1
      ) AS u ON true
      WHERE NOT EXISTS (
        SELECT 1 FROM "stories" AS s
        WHERE s."imageUrl" = v.image AND s."createdAt" > now() - interval '24 hours'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const sceneTitles = sqlList(SCENES.map((scene) => scene.title));
    const covers = sqlList([...new Set(SCENES.map((scene) => scene.cover))]);
    const storyImages = sqlList(STORY_FRAMES.map(([image]) => image));
    await queryRunner.query(`
      DELETE FROM "stories"
      WHERE "imageUrl" IN (${storyImages})
        AND "audience" = 'city'
    `);
    await queryRunner.query(`
      DELETE FROM "events"
      WHERE "title" IN (${sceneTitles})
        AND "source" IS DISTINCT FROM 'kudago'
        AND "organizerOrganizationId" IS NULL
        AND "coverUrl" IN (${covers})
    `);
  }
}
