import { Column, Entity } from "typeorm";
import { InferencingEntity } from "./inferenceEntity";
import { InfraAllocationModuleType, InfraAllocationStatus, NodeAntiAffinity } from "../config";

@Entity({ schema: 'infra_schema', name: 'infra_allocation' })
export class InfraAllocationEntity extends InferencingEntity {

    @Column({ type: 'integer', nullable: true })
    node_id: number;

    @Column({ type: 'integer', nullable: false })
    module_id: number;

    @Column({ type: 'enum', enum: InfraAllocationModuleType, nullable: true })
    module_type: InfraAllocationModuleType;

    @Column({ type: 'integer', nullable: true })
    user_id: number;

    @Column({ type: 'integer', nullable: true })
    company_id: number;

    @Column({ type: 'integer', nullable: true })
    hardware_specs_id: number;

    @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
    vram_size_gb: number;

    @Column({ type: 'varchar', nullable: true })
    gpu_count_per_pod: number | string;

    @Column({ type: 'timestamp', nullable: true })
    allocation_time: Date;

    @Column({ type: 'enum', enum: InfraAllocationStatus, nullable: true })
    status: InfraAllocationStatus;

    @Column({ type: 'varchar', length: 255, nullable: true })
    model_endpoint: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    model_proxy: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    health_check_endpoint: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    model_grpc: string;

    @Column({ type: 'int', nullable: true })
    module_type_id: number;

    @Column({ type: 'varchar', length: 255, nullable: true })
    deployment_name: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    slug: string;

    @Column({ type: 'int', nullable: true })
    cluster_id: number;

    @Column({ type: 'jsonb', nullable: true })
    scaling_parameters: any;

    @Column({ type: 'integer', nullable: true })
    min_pod_count: number;

    @Column({ type: 'integer', nullable: true })
    max_pod_count: number;

    @Column({ type: 'jsonb', nullable: true })
    scaling_metric: object;

    @Column({ type: 'enum', enum: NodeAntiAffinity, nullable: true })
    node_anti_affinity: NodeAntiAffinity;

    @Column({ type: 'boolean', default: false })
    rapid_autoscaling: boolean;

    @Column({ type: 'jsonb', nullable: true })
    config: object;

    @Column({ type: 'varchar', length: 255, nullable: true })
    inference_engine: string;
}