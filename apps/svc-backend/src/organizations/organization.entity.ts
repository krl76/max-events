// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for an Organization account — the organizer identity behind the organizer panel.
// SCOPE: OrganizationEntity columns: uuid id, name, optional contacts, unique login, password hash, timestamps.
// DEPENDS: typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - OrganizationEntity - organizations table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";

@Entity("organizations")
@Unique("UQ_organizations_login", ["login"])
export class OrganizationEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 200 })
  name!: string;

  @Column({ type: "varchar", length: 300, nullable: true })
  contacts!: string | null;

  @Column({ type: "varchar", length: 64 })
  login!: string;

  /** Never leaves the backend: no DTO carries it and no endpoint returns it. */
  @Column({ type: "varchar", length: 255 })
  passwordHash!: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
