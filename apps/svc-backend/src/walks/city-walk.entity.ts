import "reflect-metadata";
import type { CityWalk } from "@max-events/api-contracts";
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("city_walks")
@Index("IDX_city_walks_user_created", ["userId", "createdAt"])
export class CityWalkEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid", name: "user_id" })
  userId!: string;

  @Column({ type: "varchar" })
  city!: string;

  @Column({ type: "jsonb" })
  payload!: CityWalk;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;
}
