// START_MODULE_CONTRACT
// PURPOSE: TypeORM entities for a shared event vote, options, invitees, and ballots.
// SCOPE: VoteEntity, VoteOptionEntity, VoteParticipantEntity, VoteBallotEntity.
// DEPENDS: typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - VoteEntity - votes table row
// - VoteOptionEntity - vote_options table row
// - VoteParticipantEntity - vote_participants table row
// - VoteBallotEntity - vote_ballots table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";

@Entity("votes")
export class VoteEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  hostUserId!: string;

  @Column({ type: "varchar", length: 200 })
  title!: string;

  @Column({ type: "varchar", nullable: true })
  chatLink!: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}

@Entity("vote_options")
@Unique("UQ_vote_options_vote_event", ["voteId", "eventId"])
export class VoteOptionEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  voteId!: string;

  @Column({ type: "uuid" })
  eventId!: string;
}

@Entity("vote_participants")
@Unique("UQ_vote_participants_vote_user", ["voteId", "userId"])
export class VoteParticipantEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  voteId!: string;

  @Column({ type: "uuid" })
  userId!: string;
}

@Entity("vote_ballots")
@Unique("UQ_vote_ballots_vote_user", ["voteId", "userId"])
export class VoteBallotEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  voteId!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "uuid" })
  eventId!: string;
}
