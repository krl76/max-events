// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for list membership — users invited onto a custom list besides its owner.
// SCOPE: ListMemberEntity columns: listId, userId, createdAt; unique (listId, userId).
// DEPENDS: typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ListMemberEntity - list_members table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity("list_members")
@Unique("UQ_list_members_list_user", ["listId", "userId"])
export class ListMemberEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  listId!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
