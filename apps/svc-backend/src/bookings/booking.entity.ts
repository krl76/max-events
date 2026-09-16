// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for the bookings table (user registration on an event).
// SCOPE: BookingEntity columns: uuid id, userId, eventId, status, timestamps; uniqueness of active (user, event) is in the migration.
// DEPENDS: typeorm, @max-events/api-contracts (BookingStatus type)
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - BookingEntity - bookings table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import type { BookingStatus } from "@max-events/api-contracts";

@Entity("bookings")
export class BookingEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "uuid" })
  eventId!: string;

  @Column({ type: "varchar", default: "active" })
  status!: BookingStatus;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
