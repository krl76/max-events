// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for place-level social status (one row per user per venue).
// SCOPE: PlaceParticipationEntity columns: uuid id, userId, placeId, status, timestamps; unique (userId, placeId).
// DEPENDS: typeorm, @max-events/api-contracts (ParticipationStatus)
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PlaceParticipationEntity - place_participations table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";
import type { ParticipationStatus } from "@max-events/api-contracts";

@Entity("place_participations")
@Unique("UQ_place_participations_user_place", ["userId", "placeId"])
export class PlaceParticipationEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "uuid" })
  placeId!: string;

  @Column({ type: "varchar" })
  status!: ParticipationStatus;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
