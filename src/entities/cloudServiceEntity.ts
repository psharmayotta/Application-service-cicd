import { Column, Entity } from "typeorm";
import { InferencingEntity } from "./inferenceEntity";
import { CloudServiceType } from "../config";

@Entity({ schema: 'infra_schema', name: 'cloud_services' })
export class CloudServicesEntity extends InferencingEntity {

    @Column({ type: 'int', nullable: false })
    c_provider_id: number;

    @Column({ type: 'text', nullable: false })
    name: string;

    @Column({ type: 'enum', enum: CloudServiceType, nullable: true })
    service_type: CloudServiceType;

    @Column({ type: 'boolean', default: true, nullable: false })
    status: boolean;
}