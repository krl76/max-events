// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for persisted achievement grants (user + code + grantedAt).
// SCOPE: UserAchievementEntity unique (userId, code).
// DEPENDS: typeorm, @max-events/api-contracts (AchievementCode)
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - UserAchievementEntity - user_achievements table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";
import type { AchievementCode } from "@max-events/api-contracts";

@Entity("user_achievements")
@Unique("UQ_user_achievements_user_code", ["userId", "code"])
export class UserAchievementEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "varchar" })
  code!: AchievementCode;

  @Column({ type: "timestamptz" })
  grantedAt!: Date;
}
