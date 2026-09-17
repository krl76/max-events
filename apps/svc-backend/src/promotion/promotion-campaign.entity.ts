// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for paid promotion campaigns on an event.
// SCOPE: PromotionCampaignEntity period, status, billing tariff/price, optional target audience.
// DEPENDS: typeorm, @max-events/api-contracts
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PromotionCampaignEntity - promotion_campaigns table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";
import type { PromotionAudience, PromotionStatus, PromotionType } from "@max-events/api-contracts";

@Entity("promotion_campaigns")
export class PromotionCampaignEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  eventId!: string;

  @Column({ type: "uuid" })
  organizerUserId!: string;

  @Column({ type: "varchar", length: 32 })
  type!: PromotionType;

  @Column({ type: "varchar", length: 16, default: "active" })
  status!: PromotionStatus;

  @Column({ type: "timestamptz" })
  startsAt!: Date;

  @Column({ type: "timestamptz" })
  endsAt!: Date;

  @Column({ type: "varchar", length: 40 })
  tariffCode!: string;

  @Column({ type: "int" })
  priceRub!: number;

  @Column({ type: "timestamptz", nullable: true })
  paidAt!: Date | null;

  @Column({ type: "jsonb", nullable: true })
  audience!: PromotionAudience | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @Column({ type: "timestamptz", nullable: true })
  completedAt!: Date | null;
}
