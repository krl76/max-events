// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for a shared plan expense (payer + split participants).
// SCOPE: PlanExpenseEntity amount in rubles; shareUserIds jsonb.
// DEPENDS: typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PlanExpenseEntity - plan_expenses table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("plan_expenses")
export class PlanExpenseEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  planId!: string;

  @Column({ type: "varchar", length: 200 })
  title!: string;

  @Column({ type: "int" })
  amountRub!: number;

  @Column({ type: "uuid" })
  payerUserId!: string;

  @Column({ type: "jsonb" })
  shareUserIds!: string[];

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
