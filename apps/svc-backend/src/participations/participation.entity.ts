// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for the participations table (one social status per user per event).
// SCOPE: ParticipationEntity columns: uuid id, userId, eventId, status, timestamps; unique (userId, eventId).
// DEPENDS: typeorm, @max-events/api-contracts (ParticipationStatus type)
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ParticipationEntity - participations table row, unique by user+event
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";
import type { ParticipationStatus } from "@max-events/api-contracts";

@Entity("participations")
@Unique("UQ_participations_user_event", ["userId", "eventId"])
export class ParticipationEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "uuid" })
  eventId!: string;

  @Column({ type: "varchar" })
  status!: ParticipationStatus;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
