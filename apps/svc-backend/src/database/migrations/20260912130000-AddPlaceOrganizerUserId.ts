import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPlaceOrganizerUserId20260912130000 implements MigrationInterface {
  name = "AddPlaceOrganizerUserId20260912130000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "places" ADD COLUMN "organizerUserId" uuid`);
    await queryRunner.query(`ALTER TABLE "places" ADD CONSTRAINT "FK_places_organizer" FOREIGN KEY ("organizerUserId") REFERENCES "users"("id") ON DELETE SET NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "places" DROP CONSTRAINT "FK_places_organizer"`);
    await queryRunner.query(`ALTER TABLE "places" DROP COLUMN "organizerUserId"`);
  }
}
