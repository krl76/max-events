// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for the moderation report queue.
// SCOPE: ReportEntity: reporter, target type/id, reason, open/resolved.
// DEPENDS: typeorm, @max-events/api-contracts
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ReportEntity - reports table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";
import type { ReportReason, ReportStatus, ReportTargetType } from "@max-events/api-contracts";

@Entity("reports")
export class ReportEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "varchar" })
  targetType!: ReportTargetType;

  @Column({ type: "uuid" })
  targetId!: string;

  @Column({ type: "varchar" })
  reason!: ReportReason;

  @Column({ type: "varchar", default: "open" })
  status!: ReportStatus;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
