// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for the profiles table (city, interests, smart-alert prefs keyed by user id).
// SCOPE: ProfileEntity columns: userId PK, city, interests text array, smartAlerts jsonb, updatedAt.
// DEPENDS: typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ProfileEntity - profiles table row, one per user
// END_MODULE_MAP

import "reflect-metadata";
import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";
import { DEFAULT_PRIVACY, DEFAULT_SMART_ALERTS, type PrivacySettings, type SmartAlertSettings } from "@max-events/api-contracts";

@Entity("profiles")
export class ProfileEntity {
  @PrimaryColumn({ type: "uuid" })
  userId!: string;

  @Column({ type: "varchar" })
  city!: string;

  @Column({ type: "text", array: true, default: [] })
  interests!: string[];

  @Column({ type: "jsonb", default: DEFAULT_SMART_ALERTS })
  smartAlerts!: SmartAlertSettings;

  @Column({ type: "jsonb", default: DEFAULT_PRIVACY })
  privacy!: PrivacySettings;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
