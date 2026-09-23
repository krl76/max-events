import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * The catalog's rating filter groups reviews by event, and the event page reads one event's reviews.
 * UQ_reviews_user_event is keyed by userId first, so neither query could use it: both scanned the
 * whole table.
 */
export class AddReviewsEventIndex20260917000000 implements MigrationInterface {
  name = "AddReviewsEventIndex20260917000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX "IDX_reviews_event" ON "reviews" ("eventId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_reviews_event"`);
  }
}
