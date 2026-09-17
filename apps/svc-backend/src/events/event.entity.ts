// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for the events table (catalog items bound to an optional place).
// SCOPE: EventEntity columns: uuid id, catalog fields, optional placeId, published flag, timestamps.
// DEPENDS: typeorm, @max-events/api-contracts (EventCategory type)
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - EventEntity - events table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import type { EventCategory } from "@max-events/api-contracts";

@Entity("events")
export class EventEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 200 })
  title!: string;

  @Column({ type: "varchar", length: 5000, default: "" })
  description!: string;

  @Column({ type: "varchar" })
  category!: EventCategory;

  @Column({ type: "varchar" })
  city!: string;

  @Column({ type: "uuid", nullable: true })
  placeId!: string | null;

  @Column({ type: "uuid", nullable: true })
  organizerUserId!: string | null;

  @Column({ type: "timestamptz" })
  startsAt!: Date;

  @Column({ type: "timestamptz", nullable: true })
  endsAt!: Date | null;

  @Column({ type: "boolean", default: false })
  isPaid!: boolean;

  @Column({ type: "int", nullable: true })
  priceRub!: number | null;

  @Column({ type: "varchar", nullable: true })
  paymentUrl!: string | null;

  @Column({ type: "int", nullable: true })
  capacity!: number | null;

  @Column({ type: "int", default: 0 })
  bookedCount!: number;

  @Column({ type: "boolean", default: true })
  published!: boolean;

  @Column({ type: "varchar", nullable: true })
  chatLink!: string | null;

  @Column({ type: "boolean", default: true })
  chatSyncPending!: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
