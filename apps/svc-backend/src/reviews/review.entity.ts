// START_MODULE_CONTRACT
// PURPOSE: TypeORM entity for post-event reviews (one per user+event).
// SCOPE: ReviewEntity columns: user, event, stars, category scores JSON, wouldGoAgain, photos, text; IDX_reviews_event indexes the per-event reads.
// DEPENDS: typeorm
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ReviewEntity - reviews table row
// END_MODULE_MAP

import "reflect-metadata";
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

// Declared here as well as in the migration so a future migration:generate keeps it instead of
// dropping the index the catalog rating filter and the event page both read through.
@Index("IDX_reviews_event", ["eventId"])
@Entity("reviews")
export class ReviewEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "uuid" })
  eventId!: string;

  @Column({ type: "int" })
  stars!: number;

  @Column({ type: "jsonb", default: {} })
  categoryScores!: { atmosphere?: number; organization?: number; price?: number; place?: number };

  @Column({ type: "boolean" })
  wouldGoAgain!: boolean;

  @Column({ type: "text", array: true, default: () => "'{}'" })
  photoUrls!: string[];

  @Column({ type: "varchar", length: 2000, nullable: true })
  text!: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
