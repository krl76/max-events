// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for the profiles table (city and interests keyed by user id).
// SCOPE: ProfileEntity columns: userId PK, city, interests text array, updatedAt.
// DEPENDS: typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ProfileEntity - profiles table row, one per user
// END_MODULE_MAP

import "reflect-metadata";
import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity("profiles")
export class ProfileEntity {
  @PrimaryColumn({ type: "uuid" })
  userId!: string;

  @Column({ type: "varchar" })
  city!: string;

  @Column({ type: "text", array: true, default: [] })
  interests!: string[];

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
