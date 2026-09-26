// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for a shared micro-event expense (payer + split participants).
// SCOPE: MicroEventExpenseEntity amount in rubles; shareUserIds jsonb. The split math is the plan budget's.
// DEPENDS: typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MicroEventExpenseEntity - micro_event_expenses table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("micro_event_expenses")
export class MicroEventExpenseEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  microEventId!: string;

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
