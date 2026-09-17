// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for the event waitlist queue.
// SCOPE: WaitlistEntryEntity: user+event, FIFO createdAt, status, optional offer deadline.
// DEPENDS: typeorm, @max-events/api-contracts (WaitlistStatus)
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - WaitlistEntryEntity - waitlist_entries table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import type { WaitlistStatus } from "@max-events/api-contracts";

@Entity("waitlist_entries")
export class WaitlistEntryEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "uuid" })
  eventId!: string;

  @Column({ type: "varchar", default: "waiting" })
  status!: WaitlistStatus;

  @Column({ type: "timestamptz", nullable: true })
  offeredUntil!: Date | null;

  @Column({ type: "varchar", length: 40, nullable: true })
  referralCode!: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
