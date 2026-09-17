// START_MODULE_CONTRACT
// PURPOSE: TypeORM entities for shared collections, members and sectioned items.
// SCOPE: CollectionEntity, CollectionMemberEntity, CollectionItemEntity.
// DEPENDS: typeorm, @max-events/api-contracts
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CollectionEntity - collections table row
// - CollectionMemberEntity - collection_members table row
// - CollectionItemEntity - collection_items table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import type { CollectionSection } from "@max-events/api-contracts";

@Entity("collections")
export class CollectionEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  ownerUserId!: string;

  @Column({ type: "varchar", length: 200 })
  title!: string;

  @Column({ type: "varchar", nullable: true })
  chatLink!: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}

@Entity("collection_members")
export class CollectionMemberEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  collectionId!: string;

  @Column({ type: "uuid" })
  userId!: string;
}

@Entity("collection_items")
export class CollectionItemEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  collectionId!: string;

  @Column({ type: "uuid" })
  eventId!: string;

  @Column({ type: "varchar" })
  section!: CollectionSection;

  @Column({ type: "uuid" })
  addedByUserId!: string;

  @CreateDateColumn({ type: "timestamptz" })
  addedAt!: Date;
}
