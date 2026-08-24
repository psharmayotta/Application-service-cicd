import { Column, Entity } from "typeorm";
import { InferencingEntity } from "./inferenceEntity";
import { InfraNodesStatus } from "../config";

@Entity({ schema: 'infra_schema', name: 'infra_nodes' })
export class InfraNodesEntity extends InferencingEntity {

    @Column({ type: 'text', nullable: false })
    hostname: string;

    @Column({ type: 'text', nullable: false })
    location: string;

    @Column({ type: 'int', nullable: false })
    rack_id: number;

    @Column({ type: 'int', nullable: false })
    region_id: number;

    @Column({ type: 'int', nullable: false })
    cloud_provider_id: number;

    @Column({ type: 'int', nullable: false })
    zone_id: number;

    @Column({ type: 'text', nullable: false })
    ip_address: string;

    @Column({ type: 'text', nullable: false })
    mac_address: string;

    @Column({ type: 'text', nullable: false })
    serial_number: string;

    @Column({ type: 'enum', enum: InfraNodesStatus, default: InfraNodesStatus.AVAILABLE, nullable: false })
    status: InfraNodesStatus;

    @Column({ type: 'int', nullable: true })
    owner_project_id: number;

    @Column({ type: 'int', nullable: false })
    provisioned_by: number;

    @Column({ type: 'int', nullable: true })
    cluster_id: number;

    @Column({ type: 'boolean', nullable: true, default: false })
    is_reserved: boolean;
}