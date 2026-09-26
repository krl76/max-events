// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for «Пойду» on a peer's shared-calendar event (an RSVP, not a booking).
// SCOPE: CalendarGoingEntity columns: uuid id, userId, eventId, createdAt; unique (userId, eventId).
// DEPENDS: typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - CalendarGoingEntity - calendar_goings table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity("calendar_goings")
@Unique("UQ_calendar_goings_user_event", ["userId", "eventId"])
export class CalendarGoingEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "uuid" })
  eventId!: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
