// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for personal lists (preset or custom title per user).
// SCOPE: ListEntity columns: uuid id, userId, nullable preset, title, timestamps.
// DEPENDS: typeorm, @max-events/api-contracts (ListPreset)
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ListEntity - lists table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import type { ListPreset } from "@max-events/api-contracts";

@Entity("lists")
export class ListEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "varchar", nullable: true })
  preset!: ListPreset | null;

  @Column({ type: "varchar", length: 200 })
  title!: string;

  @Column({ type: "varchar", length: 16, default: "private" })
  visibility!: "public" | "private";

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
