// START_MODULE_CONTRACT
// PURPOSE: TypeORM entities for feed posts, likes and comments.
// SCOPE: FeedPostEntity (with the optional post photo), FeedLikeEntity, FeedCommentEntity.
// DEPENDS: typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - FeedPostEntity - feed_posts table row
// - FeedLikeEntity - feed_likes table row
// - FeedCommentEntity - feed_comments table row
// - FeedPostGoingEntity - one viewer marking «Я иду» on one post
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("feed_posts")
export class FeedPostEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  authorUserId!: string;

  @Column({ type: "uuid", nullable: true })
  eventId!: string | null;

  @Column({ type: "varchar", length: 5000 })
  text!: string;

  // text, not varchar(500): until object storage lands (#477) a picked photo is stored as a data URL.
  @Column({ type: "text", nullable: true })
  photoUrl!: string | null;

  @Column({ type: "text", array: true, default: [] })
  photoUrls?: string[];

  @Column({ type: "uuid", nullable: true })
  placeId?: string | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  locationLabel?: string | null;

  @Column({ type: "text", array: true, default: [] })
  taggedFriendIds?: string[];

  @Column({ type: "varchar", length: 16, default: "friends" })
  audience?: "friends" | "city" | "company";

  @Column({ type: "boolean", default: false })
  allowJoin?: boolean;

  @Column({ type: "boolean", default: true })
  published!: boolean;

  /** The post this one reposts. Null when the author wrote it. */
  @Column({ type: "uuid", nullable: true })
  repostOfPostId?: string | null;

  /** The event shared from the city rail. Null on an ordinary post and on a repost of a post. */
  @Column({ type: "uuid", nullable: true })
  repostOfEventId?: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}

@Entity("feed_likes")
export class FeedLikeEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  postId!: string;

  @Column({ type: "uuid" })
  userId!: string;
}

@Entity("feed_comments")
export class FeedCommentEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  postId!: string;

  @Column({ type: "uuid" })
  authorUserId!: string;

  @Column({ type: "varchar", length: 2000 })
  text!: string;

  /** Root comment this answers. Null on a top-level comment. */
  @Column({ type: "uuid", nullable: true })
  parentId?: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}

@Entity("feed_post_going")
export class FeedPostGoingEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  postId!: string;

  @Column({ type: "uuid" })
  userId!: string;
}
