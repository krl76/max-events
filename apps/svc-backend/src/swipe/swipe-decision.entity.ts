// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for swipe decisions on venues (like or skip, one per user+place).
// SCOPE: SwipeDecisionEntity columns: uuid id, userId, placeId, decision, createdAt; unique (userId, placeId).
// DEPENDS: typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - SwipeDecisionEntity - swipe_decisions table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

export type SwipeDecision = "like" | "skip";

@Entity("swipe_decisions")
@Unique("UQ_swipe_decisions_user_place", ["userId", "placeId"])
export class SwipeDecisionEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "uuid" })
  placeId!: string;

  @Column({ type: "varchar" })
  decision!: SwipeDecision;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
