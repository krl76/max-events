// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for organizer refer-a-friend and special-offer campaigns.
// SCOPE: PromoCampaignEntity unique (eventId, code); fulfillment counter and status.
// DEPENDS: typeorm, @max-events/api-contracts
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PromoCampaignEntity - promo_campaigns table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";
import type { PromoCampaignStatus, PromoCampaignType } from "@max-events/api-contracts";

@Entity("promo_campaigns")
@Unique("UQ_promo_campaigns_event_code", ["eventId", "code"])
export class PromoCampaignEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  eventId!: string;

  @Column({ type: "uuid" })
  organizerUserId!: string;

  @Column({ type: "varchar", length: 32 })
  type!: PromoCampaignType;

  @Column({ type: "varchar", length: 16, default: "active" })
  status!: PromoCampaignStatus;

  @Column({ type: "varchar", length: 40 })
  code!: string;

  @Column({ type: "varchar", length: 200 })
  title!: string;

  @Column({ type: "int", nullable: true })
  maxFulfillments!: number | null;

  @Column({ type: "int", default: 0 })
  fulfillmentCount!: number;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @Column({ type: "timestamptz", nullable: true })
  completedAt!: Date | null;
}
