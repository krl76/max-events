// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for the per-user calendar invite token behind «Ссылка на календарь».
// SCOPE: CalendarInviteEntity columns: uuid id, userId unique, token unique, createdAt.
// DEPENDS: typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CalendarInviteEntity - calendar_invites table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity("calendar_invites")
@Unique("UQ_calendar_invites_user", ["userId"])
@Unique("UQ_calendar_invites_token", ["token"])
export class CalendarInviteEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "uuid" })
  token!: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
