// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for the plans table (host + event + meeting point/time).
// SCOPE: PlanEntity columns: uuid id, hostUserId, eventId, meetingPoint, meetingAt, optional chatLink, reminderSentAt, leaveNowSentAt, weatherAlertSentAt, friendLeftBroadcastAt, timestamps.
// DEPENDS: typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PlanEntity - plans table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity("plans")
export class PlanEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  hostUserId!: string;

  @Column({ type: "uuid" })
  eventId!: string;

  @Column({ type: "varchar", length: 300 })
  meetingPoint!: string;

  @Column({ type: "timestamptz" })
  meetingAt!: Date;

  @Column({ type: "varchar", nullable: true })
  chatLink!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  reminderSentAt!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  leaveNowSentAt!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  weatherAlertSentAt!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  friendLeftBroadcastAt!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
