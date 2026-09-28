import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * A published place for each showcase event. Two events share one venue when they
 * really happen in the same spot: Gorky Park, and the Vorobyovy viewpoint.
 */
const PLACES: ReadonlyArray<readonly [string, string, string, number, number]> = [
  ["Патриаршие пруды", "Малая Бронная улица", "food", 55.7636, 37.5916],
  ["Парк Горького", "Крымский Вал, 9", "park", 55.7297, 37.601],
  ["Замоскворечье", "Пятницкая улица, 16", "other", 55.7414, 37.626],
  ["Зал графики на Остоженке", "Остоженка, 16", "museum", 55.741, 37.598],
  ["Воробьёвы горы", "Смотровая площадка", "park", 55.7103, 37.5426],
  ["Лекторий на Покровке", "Покровка, 19", "other", 55.7588, 37.646],
  ["Набережная Яузы", "Электрозаводская набережная", "park", 55.783, 37.705],
  ["Мастерская керамики", "Бауманская улица, 11", "other", 55.7722, 37.678],
  ["Коломенское", "проспект Андропова, 39", "park", 55.6674, 37.669],
  ["Двор на Ордынке", "Большая Ордынка, 27", "other", 55.7395, 37.6245],
  ["Пункт сбора на Сретенке", "Сретенка, 22", "other", 55.767, 37.6325],
  ["Зал на Автозаводской", "Автозаводская улица, 23", "sport", 55.7068, 37.6575],
  ["Библиотека на Чистых прудах", "Чистопрудный бульвар, 23", "museum", 55.7615, 37.6385],
];

const EVENT_PLACE: ReadonlyArray<readonly [string, string]> = [
  ["Вечер джаза на Патриарших", "Патриаршие пруды"],
  ["Ночной забег по набережной", "Парк Горького"],
  ["Экскурсия по Замоскворечью", "Замоскворечье"],
  ["Субботник в парке Горького", "Парк Горького"],
  ["Выставка молодой графики", "Зал графики на Остоженке"],
  ["Йога на Воробьёвых горах", "Воробьёвы горы"],
  ["Лекция о городе", "Лекторий на Покровке"],
  ["Велопрогулка по Яузе", "Набережная Яузы"],
  ["Мастерская керамики", "Мастерская керамики"],
  ["Поход в Коломенское", "Коломенское"],
  ["Концерт во дворе", "Двор на Ордынке"],
  ["Сбор корма для приюта", "Пункт сбора на Сретенке"],
  ["Турнир по настольному теннису", "Зал на Автозаводской"],
  ["Рассвет на Воробьёвых", "Воробьёвы горы"],
  ["Книжный клуб в библиотеке", "Библиотека на Чистых прудах"],
];

export class SeedOrganizerShowcasePlaces20260926210000 implements MigrationInterface {
  name = "SeedOrganizerShowcasePlaces20260926210000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [title, address, category, latitude, longitude] of PLACES) {
      // $1/$2 are used both as insert values and in varchar comparisons. Without one cast on every use, Postgres deduces text and varchar for the same parameter (42P08).
      await queryRunner.query(
        `
        INSERT INTO "places" ("title", "address", "city", "category", "latitude", "longitude", "organizerUserId", "organizerOrganizationId", "published")
        SELECT $1::varchar, $2::varchar, 'Москва', $3::varchar, $4::float8, $5::float8, o."organizerUserId", o.id, true
        FROM "organizations" o
        WHERE o."organizerUserId" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM "places" p
            WHERE p."title" = $1::varchar AND p."address" = $2::varchar AND p."city" = 'Москва'
          )
        `,
        [title, address, category, latitude, longitude],
      );
    }
    for (const [eventTitle, placeTitle] of EVENT_PLACE) {
      await queryRunner.query(
        `
        UPDATE "events" e
        SET "placeId" = p.id
        FROM "places" p
        WHERE e."title" = $1::varchar
          AND p."title" = $2::varchar
          AND p."city" = 'Москва'
          AND e."placeId" IS NULL
          AND p.id = (
            SELECT p2.id FROM "places" p2
            WHERE p2."title" = $2::varchar AND p2."city" = 'Москва'
            ORDER BY CASE WHEN p2."organizerOrganizationId" = e."organizerOrganizationId" THEN 0 ELSE 1 END, p2."createdAt"
            LIMIT 1
          )
        `,
        [eventTitle, placeTitle],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [title, address] of PLACES) {
      await queryRunner.query(
        `UPDATE "events" SET "placeId" = NULL WHERE "placeId" IN (SELECT "id" FROM "places" WHERE "title" = $1 AND "address" = $2 AND "city" = 'Москва')`,
        [title, address],
      );
      await queryRunner.query(`DELETE FROM "places" WHERE "title" = $1 AND "address" = $2 AND "city" = 'Москва'`, [title, address]);
    }
  }
}
