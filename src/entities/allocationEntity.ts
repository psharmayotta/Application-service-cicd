import { Column, Entity, Unique } from "typeorm";
import { InferencingEntity } from "./inferenceEntity";
import { InfraAllocationModuleType, InfraAllocationStatus } from "../config";

@Entity("infra_schema.allocation")
@Unique(["slug"])
export class AllocationEntity extends InferencingEntity {
  @Column({ type: "integer", nullable: false })
  node_id: number;

  @Column({ type: "integer", nullable: true })
  module_id: number;

  @Column({
      type: "enum", 
      enum: InfraAllocationModuleType,
      enumName: "infra_allocation_module_type",
      nullable: true
  })
  module_type: InfraAllocationModuleType;

  @Column({ type: "integer", nullable: true })
  user_id: number;

  @Column({ type: "integer", nullable: true })
  company_id: number;

  @Column({ type: "integer", nullable: true })
  hardware_specs_id: number;

  @Column({ type: "numeric", precision: 6, scale: 2, nullable: true })
  vram_size_gb: number;

  @Column({ type: "timestamp", nullable: true })
  allocation_time: Date;

  @Column({ type: "enum", enum: InfraAllocationStatus, nullable: true })
  status: InfraAllocationStatus;

  @Column({ type: "varchar", length: 255, nullable: true })
  model_endpoint: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  model_grpc: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  model_proxy: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  model_grpc_proto: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  model_protocol: string;

  @Column({ type: "integer", nullable: true })
  module_type_id: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  deployment_name: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  slug: string;

  @Column({ type: "integer", nullable: true })
  cluster_id: number;

  @Column({ type: "jsonb", nullable: true })
  scaling_parameters: object;
}