// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for a directed calendar share (owner opens their bookings to a peer).
// SCOPE: CalendarShareEntity columns: uuid id, ownerUserId, peerUserId, canEdit, createdAt; unique (owner, peer).
// DEPENDS: typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CalendarShareEntity - calendar_shares table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity("calendar_shares")
@Unique("UQ_calendar_shares_owner_peer", ["ownerUserId", "peerUserId"])
export class CalendarShareEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  ownerUserId!: string;

  @Column({ type: "uuid" })
  peerUserId!: string;

  @Column({ type: "boolean" })
  canEdit!: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
