import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveDoublebeeFeedComment20260929180000 implements MigrationInterface {
  name = "RemoveDoublebeeFeedComment20260929180000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const deleted: unknown = await queryRunner.query(`
      WITH doomed AS (
        SELECT c.id
        FROM feed_comments AS c
        INNER JOIN feed_posts AS p ON p.id = c."postId"
        INNER JOIN users AS u ON u.id = c."authorUserId"
        WHERE c.text ILIKE '%Жанна хороша%'
          AND p.text ILIKE '%кофе у окна%'
          AND lower(btrim(regexp_replace(concat(u."firstName", ' ', coalesce(u."lastName", '')), '[[:space:]]+', ' ', 'g'))) IN ('raul ivanov', 'рауль иванов')
      )
      DELETE FROM feed_comments AS target
      WHERE target.id IN (SELECT id FROM doomed)
         OR target."parentId" IN (SELECT id FROM doomed)
      RETURNING target.id
    `);
    const rows = Array.isArray(deleted) ? deleted : deleted !== null && typeof deleted === "object" && "rows" in deleted && Array.isArray(deleted.rows) ? deleted.rows : [];
    console.log(`feed comment removal: ${rows.length}`);
  }

  public async down(): Promise<void> {
    // The removed comment is not restored.
  }
}
