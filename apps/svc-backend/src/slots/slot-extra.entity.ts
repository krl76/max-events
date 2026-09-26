// START_MODULE_CONTRACT
// PURPOSE: Paid add-ons of a venue window, waitlist rows and booking chat lines.
// SCOPE: PlaceExtraEntity, SlotWaitlistEntity, SlotChatMessageEntity.
// DEPENDS: typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PlaceExtraEntity - place_extras
// - SlotWaitlistEntity - slot_waitlist
// - SlotChatMessageEntity - slot_chat_messages
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity("place_extras")
export class PlaceExtraEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  placeId!: string;

  @Column({ type: "varchar", length: 200 })
  title!: string;

  @Column({ type: "int" })
  priceRub!: number;
}

@Entity("slot_waitlist")
@Unique("UQ_slot_waitlist_slot_user", ["slotId", "userId"])
export class SlotWaitlistEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  slotId!: string;

  @Column({ type: "uuid" })
  placeId!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "int", default: 1 })
  seats!: number;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}

@Entity("slot_chat_messages")
export class SlotChatMessageEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  bookingId!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "varchar", length: 2000 })
  text!: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
