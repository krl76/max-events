// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for a booking payment (1:1 with bookings).
// SCOPE: PaymentEntity columns: bookingId unique, providerPaymentId, status, amountRub, frozen commission/net, timestamps.
// DEPENDS: typeorm, @max-events/api-contracts
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PaymentEntity - payments table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";
import type { PaymentStatus } from "@max-events/api-contracts";

@Entity("payments")
@Unique("UQ_payments_booking", ["bookingId"])
@Unique("UQ_payments_provider_payment", ["providerPaymentId"])
export class PaymentEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  bookingId!: string;

  @Column({ type: "varchar", length: 80 })
  providerPaymentId!: string;

  @Column({ type: "varchar", length: 16 })
  status!: PaymentStatus;

  @Column({ type: "int" })
  amountRub!: number;

  @Column({ type: "varchar", length: 3, default: "RUB" })
  currency!: "RUB";

  @Column({ type: "varchar", length: 300 })
  description!: string;

  @Column({ type: "int", nullable: true })
  commissionRub!: number | null;

  @Column({ type: "int", nullable: true })
  netRub!: number | null;

  @Column({ type: "int", nullable: true })
  commissionBps!: number | null;

  @Column({ type: "timestamptz", nullable: true })
  commissionFixedAt!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
