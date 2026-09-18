// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for the payment webhook event journal (dedup by provider event id).
// SCOPE: PaymentWebhookEventEntity: unique providerEventId, providerPaymentId, status.
// DEPENDS: typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PaymentWebhookEventEntity - payment_webhook_events table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";
import type { PaymentStatus } from "@max-events/api-contracts";

@Entity("payment_webhook_events")
@Unique("UQ_payment_webhook_events_provider_event", ["providerEventId"])
export class PaymentWebhookEventEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 80 })
  providerEventId!: string;

  @Column({ type: "varchar", length: 80 })
  providerPaymentId!: string;

  @Column({ type: "varchar", length: 16 })
  status!: PaymentStatus;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
