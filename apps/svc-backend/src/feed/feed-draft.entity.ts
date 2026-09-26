// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for one composer draft per author.
// SCOPE: FeedDraftEntity — unique authorUserId, optional event/place, photoUrls, audience, allowJoin.
// DEPENDS: typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - FeedDraftEntity - feed_drafts table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";

@Entity("feed_drafts")
@Unique("UQ_feed_drafts_author", ["authorUserId"])
export class FeedDraftEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  authorUserId!: string;

  @Column({ type: "uuid", nullable: true })
  eventId!: string | null;

  @Column({ type: "varchar", length: 5000, default: "" })
  text!: string;

  @Column({ type: "text", array: true, default: [] })
  photoUrls!: string[];

  @Column({ type: "uuid", nullable: true })
  placeId!: string | null;

  @Column({ type: "text", array: true, default: [] })
  taggedFriendIds!: string[];

  @Column({ type: "varchar", length: 16, default: "friends" })
  audience!: "friends" | "city" | "company";

  @Column({ type: "boolean", default: false })
  allowJoin!: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
