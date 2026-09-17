// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for organizer promocodes on an event.
// SCOPE: PromoCodeEntity unique (eventId, code); redemption counter.
// DEPENDS: typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PromoCodeEntity - promo_codes table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity("promo_codes")
@Unique("UQ_promo_codes_event_code", ["eventId", "code"])
export class PromoCodeEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  eventId!: string;

  @Column({ type: "uuid" })
  organizerUserId!: string;

  @Column({ type: "varchar", length: 40 })
  code!: string;

  @Column({ type: "int", nullable: true })
  maxRedemptions!: number | null;

  @Column({ type: "int", default: 0 })
  redeemedCount!: number;

  @Column({ type: "timestamptz", nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
