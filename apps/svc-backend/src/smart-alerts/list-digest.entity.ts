// START_MODULE_CONTRACT
// PURPOSE: Dedup rows for list-digest smart alerts (same user + weekend + event set).
// SCOPE: ListDigestSendEntity unique (userId, windowKey, fingerprint).
// DEPENDS: typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ListDigestSendEntity - list_digest_sends table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity("list_digest_sends")
@Unique("UQ_list_digest_sends_user_window_fp", ["userId", "windowKey", "fingerprint"])
export class ListDigestSendEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "varchar", length: 40 })
  windowKey!: string;

  @Column({ type: "varchar", length: 64 })
  fingerprint!: string;

  @Column({ type: "int" })
  eventCount!: number;

  @CreateDateColumn({ type: "timestamptz" })
  sentAt!: Date;
}
