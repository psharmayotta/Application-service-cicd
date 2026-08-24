import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";
import { InferencingEntity } from "./inferenceEntity";

@Entity('infra_schema.pod_logs')
export class PodLogEntity extends InferencingEntity {

  @Column({ name: "pod_name", type: "varchar", length: 255 })
  pod_name: string;

  @Column({ name: "status", type: "varchar", length: 50 })
  status: string;

  @Column({ name: "infra_allocation_id", type: "int", nullable: true })
  infra_allocation_id: number;

  @Column({ name: "message", type: "json", nullable: true })
  message: object;

  @Column({ name: "timestamp", type: "timestamptz" })
  timestamp: Date;
}
