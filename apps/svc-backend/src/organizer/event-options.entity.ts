// START_MODULE_CONTRACT
// PURPOSE: Per-event organizer options stored off the Event row.
// SCOPE: EventOptionsEntity — unique eventId, waitlist/in-app/external URL/weekly recurrence.
// DEPENDS: typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - EventOptionsEntity - event_options table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";

@Entity("event_options")
@Unique("UQ_event_options_event", ["eventId"])
export class EventOptionsEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  eventId!: string;

  @Column({ type: "boolean", default: true })
  waitlistEnabled!: boolean;

  @Column({ type: "boolean", default: true })
  registrationInApp!: boolean;

  @Column({ type: "varchar", nullable: true })
  externalUrl!: string | null;

  @Column({ type: "varchar", length: 16, nullable: true })
  recurrenceRule!: "weekly" | null;

  @Column({ type: "timestamptz", nullable: true })
  recurrenceUntil!: Date | null;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
