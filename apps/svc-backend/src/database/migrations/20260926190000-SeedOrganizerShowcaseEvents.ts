import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Fifteen published events for each organizer account that already exists, so the cabinet list
 * is not a single row. Titles are stable: a second run inserts nothing that is already there.
 */
const SHOWCASE_TITLES = ["Вечер джаза на Патриарших", "Ночной забег по набережной", "Экскурсия по Замоскворечью", "Субботник в парке Горького", "Выставка молодой графики", "Йога на Воробьёвых горах", "Лекция о городе", "Велопрогулка по Яузе", "Мастерская керамики", "Поход в Коломенское", "Концерт во дворе", "Сбор корма для приюта", "Турнир по настольному теннису", "Рассвет на Воробьёвых", "Книжный клуб в библиотеке"] as const;

export class SeedOrganizerShowcaseEvents20260926190000 implements MigrationInterface {
  name = "SeedOrganizerShowcaseEvents20260926190000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "events" (
        "title", "description", "category", "city", "placeId",
        "organizerUserId", "organizerOrganizationId",
        "startsAt", "endsAt", "isPaid", "priceRub", "paymentUrl", "capacity",
        "bookedCount", "published", "chatSyncPending"
      )
      SELECT
        v.title, v.description, v.category, 'Москва', NULL,
        o."organizerUserId", o.id,
        v.starts_at, v.ends_at, v.is_paid, v.price_rub, v.payment_url, v.capacity,
        0, true, true
      FROM "organizations" o
      CROSS JOIN (VALUES
        ('Вечер джаза на Патриарших'::varchar, 'Живая музыка на открытой веранде. Вход свободный.'::varchar, 'afisha'::varchar, TIMESTAMPTZ '2026-10-03 19:00+03', TIMESTAMPTZ '2026-10-03 22:00+03', false, NULL::int, NULL::varchar, 80),
        ('Ночной забег по набережной', 'Пять километров вдоль Москвы-реки, старт у парка Горького.', 'sport', TIMESTAMPTZ '2026-10-04 21:00+03', TIMESTAMPTZ '2026-10-04 23:00+03', false, NULL, NULL, 200),
        ('Экскурсия по Замоскворечью', 'Пешая прогулка по дворам и палатам. Билет на сайте организатора.', 'tourism', TIMESTAMPTZ '2026-10-05 12:00+03', TIMESTAMPTZ '2026-10-05 14:30+03', true, 900, 'https://tickets.example.com/zamoskvorechie', 25),
        ('Субботник в парке Горького', 'Перчатки и мешки выдаём на месте. Можно прийти на час.', 'volunteering', TIMESTAMPTZ '2026-10-10 11:00+03', TIMESTAMPTZ '2026-10-10 14:00+03', false, NULL, NULL, 60),
        ('Выставка молодой графики', 'Один зал, работы этого года. Билет на сайте организатора.', 'afisha', TIMESTAMPTZ '2026-10-11 16:00+03', TIMESTAMPTZ '2026-10-11 20:00+03', true, 500, 'https://tickets.example.com/grafika', 40),
        ('Йога на Воробьёвых горах', 'Коврик с собой. Занятие на смотровой, если нет дождя.', 'sport', TIMESTAMPTZ '2026-10-12 09:00+03', TIMESTAMPTZ '2026-10-12 10:30+03', false, NULL, NULL, 30),
        ('Лекция о городе', 'Как менялась Москва за последние сто лет. Вопросы в конце.', 'afisha', TIMESTAMPTZ '2026-10-14 19:00+03', TIMESTAMPTZ '2026-10-14 21:00+03', false, NULL, NULL, 100),
        ('Велопрогулка по Яузе', 'Маршрут двадцать километров, темп спокойный. Велосипед свой.', 'sport', TIMESTAMPTZ '2026-10-17 11:00+03', TIMESTAMPTZ '2026-10-17 14:00+03', false, NULL, NULL, 20),
        ('Мастерская керамики', 'Лепим чашку и забираем после обжига. Место по предоплате.', 'afisha', TIMESTAMPTZ '2026-10-18 15:00+03', TIMESTAMPTZ '2026-10-18 18:00+03', true, 1500, 'https://tickets.example.com/keramika', 12),
        ('Поход в Коломенское', 'Парк, церковь и шашлык не обещаем. Встреча у входа.', 'tourism', TIMESTAMPTZ '2026-10-19 13:00+03', TIMESTAMPTZ '2026-10-19 16:00+03', false, NULL, NULL, 35),
        ('Концерт во дворе', 'Акустика, два сета. Билет на сайте организатора.', 'afisha', TIMESTAMPTZ '2026-10-24 18:30+03', TIMESTAMPTZ '2026-10-24 21:00+03', true, 700, 'https://tickets.example.com/dvor', 50),
        ('Сбор корма для приюта', 'Приносите сухой корм. Список нужного — в описании на месте.', 'volunteering', TIMESTAMPTZ '2026-10-25 12:00+03', TIMESTAMPTZ '2026-10-25 16:00+03', false, NULL, NULL, NULL),
        ('Турнир по настольному теннису', 'Парный разряд, ракетки выдаём. Уровень любой.', 'sport', TIMESTAMPTZ '2026-10-26 17:00+03', TIMESTAMPTZ '2026-10-26 20:00+03', false, NULL, NULL, 16),
        ('Рассвет на Воробьёвых', 'Встречаемся затемно и смотрим, как встаёт город.', 'tourism', TIMESTAMPTZ '2026-10-31 06:15+03', TIMESTAMPTZ '2026-10-31 08:00+03', false, NULL, NULL, 40),
        ('Книжный клуб в библиотеке', 'Обсуждаем одну книгу. Текст можно не дочитывать.', 'afisha', TIMESTAMPTZ '2026-11-02 19:00+03', TIMESTAMPTZ '2026-11-02 21:00+03', false, NULL, NULL, 18)
      ) AS v(title, description, category, starts_at, ends_at, is_paid, price_rub, payment_url, capacity)
      WHERE o."organizerUserId" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "events" e
          WHERE e."title" = v.title AND e."organizerOrganizationId" = o.id
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const list = SHOWCASE_TITLES.map((title) => `'${title.replace(/'/g, "''")}'`).join(", ");
    await queryRunner.query(`DELETE FROM "events" WHERE "title" IN (${list})`);
  }
}
