import { MigrationInterface, QueryRunner } from "typeorm";

/** Known venue photographs. Applied even when the demo seed does not run. */
const PLACE_PHOTOS: ReadonlyArray<readonly [string, string]> = [
  ["Парк Горького", "/onboarding/gorky.jpg"],
  ["Сокольники", "/covers/places/sokolniki.jpg"],
  ["ВДНХ", "/covers/places/vdnh.jpg"],
  ["Парк «Зарядье»", "/covers/places/zaryadye.jpg"],
  ["Коломенское", "/covers/kolomenskoe.jpg"],
  ["Царицыно", "/covers/visits/tsaritsyno.jpg"],
  ["Кусково", "/covers/places/kuskovo.jpg"],
  ["Аптекарский огород", "/covers/places/apothecary.jpg"],
  ["Измайловский парк", "/covers/places/izmailovo.jpg"],
  ["Парк Победы", "/covers/places/pobedy.jpg"],
  ["Нескучный сад", "/covers/places/neskuchny.jpg"],
  ["Третьяковская галерея", "/covers/visits/museum.jpg"],
  ["ГМИИ им. А.С. Пушкина", "/covers/places/pushkin.jpg"],
  ["ГМИИ им. А. С. Пушкина", "/covers/places/pushkin.jpg"],
  ["Музей космонавтики", "/covers/places/cosmos.jpg"],
  ["Дарвиновский музей", "/covers/places/darwin.jpg"],
  ["Музей «Гараж»", "/covers/places/garage.jpg"],
  ["Кофейня «Даблби»", "/covers/visits/cafe.jpg"],
  ["Пекарня «Батон»", "/covers/places/baton.jpg"],
  ["Кофейня «Сёрф»", "/covers/places/surf.jpg"],
  ["Антикафе «Циферблат»", "/covers/concert.jpg"],
  ["Лужники", "/covers/places/luzhniki.jpg"],
  ["«Лужники»", "/covers/places/luzhniki.jpg"],
  ["СК «Олимпийский»", "/covers/places/olympic.jpg"],
  ["ВТБ Арена", "/covers/places/vtb.jpg"],
  ["УСЗ «Москвич»", "/covers/places/moskvich.jpg"],
  ["ДК «Москва»", "/covers/places/dk.jpg"],
  ["Кинотеатр «Иллюзион»", "/covers/places/illusion.jpg"],
];

export class SetPlacePhotos20260930120000 implements MigrationInterface {
  name = "SetPlacePhotos20260930120000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [title, logoUrl] of PLACE_PHOTOS) {
      await queryRunner.query(`UPDATE "places" SET "logoUrl" = $1 WHERE "title" = $2 AND ("logoUrl" IS NULL OR "logoUrl" = '')`, [logoUrl, title]);
    }
    await queryRunner.query(`UPDATE "places" SET "logoUrl" = '/onboarding/gorky.jpg' WHERE "logoUrl" IS NULL AND "category" = 'park'`);
    await queryRunner.query(`UPDATE "places" SET "logoUrl" = '/covers/visits/museum.jpg' WHERE "logoUrl" IS NULL AND "category" = 'museum'`);
    await queryRunner.query(`UPDATE "places" SET "logoUrl" = '/covers/visits/cafe.jpg' WHERE "logoUrl" IS NULL AND "category" = 'food'`);
    await queryRunner.query(`UPDATE "places" SET "logoUrl" = '/covers/places/luzhniki.jpg' WHERE "logoUrl" IS NULL AND "category" = 'sport'`);
    await queryRunner.query(`UPDATE "places" SET "logoUrl" = '/covers/concert.jpg' WHERE "logoUrl" IS NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [title, logoUrl] of PLACE_PHOTOS) {
      await queryRunner.query(`UPDATE "places" SET "logoUrl" = NULL WHERE "title" = $1 AND "logoUrl" = $2`, [title, logoUrl]);
    }
  }
}
