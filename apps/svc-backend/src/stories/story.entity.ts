// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for stories (photos published to the stories rail).
// SCOPE: StoryEntity (author, image, creation time).
// DEPENDS: typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - StoryEntity - stories table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("stories")
export class StoryEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "text" })
  imageUrl!: string;

  @Column({ type: "varchar", length: 500, default: "" })
  text?: string;

  @Column({ type: "jsonb", nullable: true })
  sticker?: { eventId: string; title: string; subtitle: string; seatsLeft: number | null } | null;

  @Column({ type: "jsonb", nullable: true })
  poll?: { question: string; options: string[]; answer: number | null } | null;

  @Column({ type: "varchar", length: 32, default: "friends" })
  audience?: "close-friends" | "friends" | "city";

  @Column({ type: "jsonb", default: [] })
  objects?: Array<{ id?: string; kind: "text" | "event" | "poll" | "seats"; x: number; y: number; scale?: number; text?: string }>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
