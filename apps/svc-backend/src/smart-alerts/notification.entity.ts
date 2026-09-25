// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for the in-app notifications inbox.
// SCOPE: NotificationEntity columns: userId, type, optional actor, copy, read/answer stamps, link/actions jsonb, urgency.
// DEPENDS: typeorm, @max-events/api-contracts
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - NotificationEntity - notifications table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";
import type { NotificationAction, NotificationLink, NotificationType } from "@max-events/api-contracts";

@Entity("notifications")
export class NotificationEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "varchar" })
  type!: NotificationType;

  @Column({ type: "uuid", nullable: true })
  actorUserId!: string | null;

  @Column({ type: "varchar", length: 300 })
  title!: string;

  @Column({ type: "varchar", length: 2000, default: "" })
  body!: string;

  @Column({ type: "varchar", length: 300, nullable: true })
  quote!: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @Column({ type: "timestamptz", nullable: true })
  readAt!: Date | null;

  @Column({ type: "jsonb", nullable: true })
  link!: NotificationLink | null;

  @Column({ type: "jsonb", default: [] })
  actions!: NotificationAction[];

  @Column({ type: "timestamptz", nullable: true })
  deadlineAt!: Date | null;

  @Column({ type: "varchar", length: 80, nullable: true })
  answeredActionId!: string | null;

  @Column({ type: "boolean", default: false })
  urgent!: boolean;
}
