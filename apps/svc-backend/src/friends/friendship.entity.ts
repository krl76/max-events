// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for the friendships table (directed user → friend edges).
// SCOPE: FriendshipEntity columns: uuid id, userId, friendUserId, closeFriend, timestamps; unique (userId, friendUserId).
// DEPENDS: typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - FriendshipEntity - friendships table row, unique by owner+friend
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";

@Entity("friendships")
@Unique("UQ_friendships_user_friend", ["userId", "friendUserId"])
export class FriendshipEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "uuid" })
  friendUserId!: string;

  /** The viewer marked this person as a close friend. Stories with audience close-friends are shown only to these rows. */
  @Column({ type: "boolean", default: false })
  closeFriend!: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
