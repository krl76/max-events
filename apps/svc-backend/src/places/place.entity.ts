// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for the places table (venues that host events).
// SCOPE: PlaceEntity columns: uuid id, title, address, city, category, geo, optional logoUrl, timestamps; unique (title, address, city).
// DEPENDS: typeorm, @max-events/api-contracts (PlaceCategory type)
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - PlaceEntity - places table row, unique by title+address+city
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";
import type { PlaceCategory } from "@max-events/api-contracts";

@Entity("places")
@Unique("UQ_places_title_address_city", ["title", "address", "city"])
export class PlaceEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 200 })
  title!: string;

  @Column({ type: "varchar", length: 300 })
  address!: string;

  @Column({ type: "varchar" })
  city!: string;

  @Column({ type: "varchar" })
  category!: PlaceCategory;

  @Column({ type: "double precision" })
  latitude!: number;

  @Column({ type: "double precision" })
  longitude!: number;

  @Column({ type: "uuid", nullable: true })
  organizerUserId!: string | null;

  @Column({ type: "uuid", nullable: true })
  organizerOrganizationId?: string | null;

  @Column({ type: "boolean", default: true })
  published!: boolean;

  @Column({ type: "varchar", nullable: true })
  logoUrl?: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
