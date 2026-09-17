// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for check-ins (exactly one of eventId or placeId).
// SCOPE: CheckInEntity columns: userId, nullable eventId/placeId, visitDate (UTC day for place visits), checkedInAt.
// DEPENDS: typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CheckInEntity - check_ins table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("check_ins")
export class CheckInEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "uuid", nullable: true })
  eventId!: string | null;

  @Column({ type: "uuid", nullable: true })
  placeId!: string | null;

  @Column({ type: "date", nullable: true })
  visitDate!: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  checkedInAt!: Date;
}
