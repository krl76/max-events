import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema20260911000000 implements MigrationInterface {
  public async up(_queryRunner: QueryRunner): Promise<void> {
    // No entities yet: baseline migration establishes the migrations table.
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {}
}
