import { MigrationInterface, QueryRunner } from "typeorm";

/** Photos that match the showcase titles. Files ship with the miniapp under /covers. */
const SHOWCASE_COVERS: ReadonlyArray<readonly [string, string]> = [
  ["Вечер джаза на Патриарших", "/covers/jazz.jpg"],
  ["Ночной забег по набережной", "/covers/run.jpg"],
  ["Экскурсия по Замоскворечью", "/covers/tour.jpg"],
  ["Субботник в парке Горького", "/covers/cleanup.jpg"],
  ["Выставка молодой графики", "/covers/graphics.jpg"],
  ["Йога на Воробьёвых горах", "/covers/yoga.jpg"],
  ["Лекция о городе", "/covers/lecture.jpg"],
  ["Велопрогулка по Яузе", "/covers/bike.jpg"],
  ["Мастерская керамики", "/covers/ceramic.jpg"],
  ["Поход в Коломенское", "/covers/kolomenskoe.jpg"],
  ["Концерт во дворе", "/covers/concert.jpg"],
  ["Сбор корма для приюта", "/covers/shelter.jpg"],
  ["Турнир по настольному теннису", "/covers/pingpong.jpg"],
  ["Рассвет на Воробьёвых", "/covers/dawn.jpg"],
  ["Книжный клуб в библиотеке", "/covers/books.jpg"],
];

export class SetOrganizerShowcaseCovers20260926200000 implements MigrationInterface {
  name = "SetOrganizerShowcaseCovers20260926200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [title, coverUrl] of SHOWCASE_COVERS) {
      await queryRunner.query(`UPDATE "events" SET "coverUrl" = $1 WHERE "title" = $2`, [coverUrl, title]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [title] of SHOWCASE_COVERS) {
      await queryRunner.query(`UPDATE "events" SET "coverUrl" = NULL WHERE "title" = $1`, [title]);
    }
  }
}
