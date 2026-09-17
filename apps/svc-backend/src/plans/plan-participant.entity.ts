// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for plan participants (invited friends, not the host).
// SCOPE: PlanParticipantEntity columns: planId, userId, status, reminderSentAt, leaveNowSentAt, friendLeftBroadcastAt, pollSentAt; unique (planId, userId).
// DEPENDS: typeorm, @max-events/api-contracts (PlanParticipantStatus)
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PlanParticipantEntity - plan_participants table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";
import type { PlanParticipantStatus } from "@max-events/api-contracts";

@Entity("plan_participants")
@Unique("UQ_plan_participants_plan_user", ["planId", "userId"])
export class PlanParticipantEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  planId!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "varchar" })
  status!: PlanParticipantStatus;

  @Column({ type: "timestamptz", nullable: true })
  reminderSentAt!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  leaveNowSentAt!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  friendLeftBroadcastAt!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  pollSentAt!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
