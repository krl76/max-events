import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateVotes20260912200000 implements MigrationInterface {
  name = "CreateVotes20260912200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "votes" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "hostUserId" uuid NOT NULL, "title" character varying(200) NOT NULL, "chatLink" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_votes" PRIMARY KEY ("id"), CONSTRAINT "FK_votes_host" FOREIGN KEY ("hostUserId") REFERENCES "users"("id") ON DELETE CASCADE)`);
    await queryRunner.query(`CREATE TABLE "vote_options" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "voteId" uuid NOT NULL, "eventId" uuid NOT NULL, CONSTRAINT "PK_vote_options" PRIMARY KEY ("id"), CONSTRAINT "UQ_vote_options_vote_event" UNIQUE ("voteId", "eventId"), CONSTRAINT "FK_vote_options_vote" FOREIGN KEY ("voteId") REFERENCES "votes"("id") ON DELETE CASCADE, CONSTRAINT "FK_vote_options_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE)`);
    await queryRunner.query(`CREATE TABLE "vote_participants" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "voteId" uuid NOT NULL, "userId" uuid NOT NULL, CONSTRAINT "PK_vote_participants" PRIMARY KEY ("id"), CONSTRAINT "UQ_vote_participants_vote_user" UNIQUE ("voteId", "userId"), CONSTRAINT "FK_vote_participants_vote" FOREIGN KEY ("voteId") REFERENCES "votes"("id") ON DELETE CASCADE, CONSTRAINT "FK_vote_participants_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE)`);
    await queryRunner.query(`CREATE TABLE "vote_ballots" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "voteId" uuid NOT NULL, "userId" uuid NOT NULL, "eventId" uuid NOT NULL, CONSTRAINT "PK_vote_ballots" PRIMARY KEY ("id"), CONSTRAINT "UQ_vote_ballots_vote_user" UNIQUE ("voteId", "userId"), CONSTRAINT "FK_vote_ballots_vote" FOREIGN KEY ("voteId") REFERENCES "votes"("id") ON DELETE CASCADE, CONSTRAINT "FK_vote_ballots_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE, CONSTRAINT "FK_vote_ballots_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "vote_ballots"`);
    await queryRunner.query(`DROP TABLE "vote_participants"`);
    await queryRunner.query(`DROP TABLE "vote_options"`);
    await queryRunner.query(`DROP TABLE "votes"`);
  }
}
