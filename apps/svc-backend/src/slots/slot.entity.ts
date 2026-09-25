// START_MODULE_CONTRACT
// PURPOSE: TypeORM entities for venue time windows and slot bookings.
// SCOPE: PlaceSlotEntity (a bookable window), SlotBookingEntity (who holds it).
// DEPENDS: typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PlaceSlotEntity - place_slots table row
// - SlotBookingEntity - slot_bookings table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";

@Entity("place_slots")
@Unique("UQ_place_slots_place_start", ["placeId", "startsAt"])
export class PlaceSlotEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  placeId!: string;

  @Column({ type: "timestamptz" })
  startsAt!: Date;

  @Column({ type: "timestamptz" })
  endsAt!: Date;

  @Column({ type: "int" })
  capacity!: number;

  @Column({ type: "int", default: 0 })
  takenSeats!: number;

  @Column({ type: "int", nullable: true })
  priceRub!: number | null;

  @Column({ type: "varchar", length: 200, default: "Площадка" })
  unitTitle!: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}

@Entity("slot_bookings")
@Unique("UQ_slot_bookings_slot_user_active", ["slotId", "userId"])
export class SlotBookingEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  slotId!: string;

  @Column({ type: "uuid" })
  placeId!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "varchar", default: "active" })
  status!: "active" | "cancelled";

  @Column({ type: "int", default: 1 })
  partySize!: number;

  @Column({ type: "text", array: true, default: [] })
  extraIds!: string[];

  @Column({ type: "int", default: 0 })
  totalRub!: number;

  @Column({ type: "timestamptz", nullable: true })
  cancelBefore!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
