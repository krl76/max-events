// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for a single campaign fulfillment (referred new user + booking).
// SCOPE: PromoFulfillmentEntity unique per campaign+user and campaign+booking.
// DEPENDS: typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PromoFulfillmentEntity - promo_fulfillments table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity("promo_fulfillments")
@Unique("UQ_promo_fulfillments_campaign_user", ["campaignId", "referredUserId"])
@Unique("UQ_promo_fulfillments_campaign_booking", ["campaignId", "bookingId"])
export class PromoFulfillmentEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  campaignId!: string;

  @Column({ type: "uuid" })
  referredUserId!: string;

  @Column({ type: "uuid" })
  bookingId!: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
