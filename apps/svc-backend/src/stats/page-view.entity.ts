// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for deduped page views (user + target + Moscow day).
// SCOPE: PageViewEntity unique (userId, targetType, targetId, viewedOn).
// DEPENDS: typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PageViewEntity - page_views table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity("page_views")
@Unique("UQ_page_views_user_target_day", ["userId", "targetType", "targetId", "viewedOn"])
export class PageViewEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "varchar" })
  targetType!: "event" | "place";

  @Column({ type: "uuid" })
  targetId!: string;

  @Column({ type: "date" })
  viewedOn!: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
