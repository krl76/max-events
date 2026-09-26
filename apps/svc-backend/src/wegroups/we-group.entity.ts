// START_MODULE_CONTRACT
// PURPOSE: TypeORM entities for «Мы» trip groups, members, and bound events/places.
// SCOPE: WeGroupEntity, WeGroupMemberEntity, WeGroupItemEntity.
// DEPENDS: typeorm, @max-events/api-contracts
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - WeGroupEntity - we_groups table row
// - WeGroupMemberEntity - we_group_members table row
// - WeGroupItemEntity - we_group_items table row
// - WeGroupPhotoEntity - we_group_photos table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";
import type { WeGroupStatus } from "@max-events/api-contracts";

@Entity("we_groups")
export class WeGroupEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  ownerUserId!: string;

  @Column({ type: "varchar", length: 200 })
  title!: string;

  @Column({ type: "varchar", nullable: true })
  chatLink!: string | null;

  @Column({ type: "varchar", length: 16, default: "active" })
  status!: WeGroupStatus;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;

  @Column({ type: "timestamptz", nullable: true })
  archivedAt!: Date | null;
}

@Entity("we_group_members")
@Unique("UQ_we_group_members_group_user", ["groupId", "userId"])
export class WeGroupMemberEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  groupId!: string;

  @Column({ type: "uuid" })
  userId!: string;
}

@Entity("we_group_items")
export class WeGroupItemEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  groupId!: string;

  @Column({ type: "uuid", nullable: true })
  eventId!: string | null;

  @Column({ type: "uuid", nullable: true })
  placeId!: string | null;
}

@Entity("we_group_photos")
export class WeGroupPhotoEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  groupId!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "text" })
  url!: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
