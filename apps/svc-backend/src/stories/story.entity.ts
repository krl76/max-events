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

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
