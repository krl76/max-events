// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for the gatherings table (host + event + proposed meeting time).
// SCOPE: GatheringEntity columns: uuid id, hostUserId, eventId, proposedMeetingAt, status, optional chatLink, timestamps.
// DEPENDS: typeorm, @max-events/api-contracts (GatheringStatus)
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - GatheringEntity - gatherings table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import type { GatheringStatus } from "@max-events/api-contracts";

@Entity("gatherings")
export class GatheringEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  hostUserId!: string;

  @Column({ type: "uuid" })
  eventId!: string;

  @Column({ type: "timestamptz" })
  proposedMeetingAt!: Date;

  @Column({ type: "varchar" })
  status!: GatheringStatus;

  @Column({ type: "varchar", nullable: true })
  chatLink!: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
