// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for catalog subscriptions (organizer, place, or interest).
// SCOPE: SubscriptionEntity columns: userId, type, nullable organizerUserId/placeId/interest, createdAt.
// DEPENDS: typeorm, @max-events/api-contracts (SubscriptionType)
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - SubscriptionEntity - subscriptions table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";
import type { SubscriptionType } from "@max-events/api-contracts";

@Entity("subscriptions")
export class SubscriptionEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "varchar" })
  type!: SubscriptionType;

  @Column({ type: "uuid", nullable: true })
  organizerUserId!: string | null;

  @Column({ type: "uuid", nullable: true })
  placeId!: string | null;

  @Column({ type: "uuid", nullable: true })
  targetUserId!: string | null;

  @Column({ type: "varchar", nullable: true })
  interest!: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
