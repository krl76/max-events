// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for gathering invitees (one response row per invited friend).
// SCOPE: GatheringInviteeEntity columns: gatheringId, userId, response, respondedAt, reminderSentAt; unique (gatheringId, userId).
// DEPENDS: typeorm, @max-events/api-contracts (InviteeResponse)
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - GatheringInviteeEntity - gathering_invitees table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";
import type { InviteeResponse } from "@max-events/api-contracts";

@Entity("gathering_invitees")
@Unique("UQ_gathering_invitees_gathering_user", ["gatheringId", "userId"])
export class GatheringInviteeEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  gatheringId!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "varchar" })
  response!: InviteeResponse;

  @Column({ type: "timestamptz", nullable: true })
  respondedAt!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  reminderSentAt!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
