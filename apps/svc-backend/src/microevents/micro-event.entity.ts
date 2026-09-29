// START_MODULE_CONTRACT
// PURPOSE: TypeORM entities for UGC micro-events and their participants.
// SCOPE: MicroEventEntity (what/when/where/limit) and MicroEventParticipantEntity (user join).
// DEPENDS: typeorm, @max-events/api-contracts
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MicroEventEntity - micro_events table row
// - MicroEventParticipantEntity - micro_event_participants table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";
import type { MicroEventStatus } from "@max-events/api-contracts";

@Entity("micro_events")
export class MicroEventEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  authorId!: string;

  @Column({ type: "varchar", length: 200 })
  title!: string;

  @Column({ type: "timestamptz" })
  startsAt!: Date;

  @Column({ type: "varchar", length: 300, nullable: true })
  locationText!: string | null;

  @Column({ type: "uuid", nullable: true })
  placeId!: string | null;

  @Column({ type: "int", nullable: true })
  participantsLimit!: number | null;

  @Column({ type: "varchar", default: "open" })
  status!: MicroEventStatus;

  @Column({ type: "boolean", default: true })
  published!: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}

@Entity("micro_event_participants")
export class MicroEventParticipantEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  microEventId!: string;

  @Column({ type: "uuid" })
  userId!: string;
}
