import { Column, Entity } from "typeorm";
import { InferencingEntity } from "./inferenceEntity";
import { ClusterEnvironment, ClusterStatus, ClusterType } from "../config";

@Entity({ schema: 'infra_schema', name: 'clusters' })
export class ClustersEntity extends InferencingEntity {

    @Column({ type: 'text', nullable: false })
    cluster_name: string;

    @Column({ type: 'int', nullable: false })
    member_id: number;

    @Column({ type: 'int', nullable: false })
    company_id: number;

    @Column({ type: 'int', nullable: false })
    cloud_account_id: number;

    @Column({ type: 'int', nullable: false })
    cloud_region_id: number;

    @Column({ type: 'int', nullable: false })
    hosted_zone_id: number;

    @Column({ type: 'jsonb', nullable: true })
    tags: any[];

    @Column({ type: 'enum', enum: ClusterEnvironment, default: ClusterEnvironment.PRODUCTION })
    env: ClusterEnvironment;

    @Column({ type: 'varchar', length: 60, nullable: true })
    custom_env_description: string;

    @Column({ type: 'boolean', default: false, nullable: false })
    enable_install_training_tooling: boolean;

    @Column({ type: 'enum', enum: ClusterType, default: ClusterType.CREATED, nullable: false })
    cluster_type: ClusterType;

    @Column({ type: 'enum', enum: ClusterStatus, default: ClusterStatus.QUEUED, nullable: false })
    status: ClusterStatus;

    @Column({ type: 'boolean', default: false, nullable: false })
    is_default: boolean;
}