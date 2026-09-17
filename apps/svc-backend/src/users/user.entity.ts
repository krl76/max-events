// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for the users table (MAX-identified account).
// SCOPE: UserEntity columns: uuid id, unique maxUserId, profile fields, timestamps.
// DEPENDS: typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - UserEntity - users table row, unique by MAX user id
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity("users")
export class UserEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", unique: true })
  maxUserId!: string;

  @Column({ type: "varchar" })
  firstName!: string;

  @Column({ type: "varchar", nullable: true })
  lastName!: string | null;

  @Column({ type: "varchar", nullable: true })
  avatarUrl!: string | null;

  @Column({ type: "boolean", default: false })
  bannedFromPublishing!: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
