// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for list items (exactly one of eventId or placeId).
// SCOPE: ListItemEntity columns: listId, nullable eventId, nullable placeId, addedAt.
// DEPENDS: typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ListItemEntity - list_items table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("list_items")
export class ListItemEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  listId!: string;

  @Column({ type: "uuid", nullable: true })
  eventId!: string | null;

  @Column({ type: "uuid", nullable: true })
  placeId!: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  addedAt!: Date;
}
