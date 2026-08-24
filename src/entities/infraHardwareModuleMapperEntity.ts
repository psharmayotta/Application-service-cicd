import { Column, Entity } from "typeorm";
import { InferencingEntity } from "./inferenceEntity";
import { InfraHardwareModuleMapperStatus } from "../config";

@Entity({ schema: 'infra_schema', name: 'infra_hardware_module_mapper' })
export class InfraHardwareModuleMapperEntity extends InferencingEntity {

    @Column({ type: 'int', nullable: false })
    module_id: number;

    @Column({ type: 'int', nullable: false })
    hardware_id: number;

    @Column({ type: 'int', nullable: true })
    assigned_core: number;

    @Column({ type: 'int', nullable: true })
    assigned_storage: number;

    @Column({ type: 'enum', enum: InfraHardwareModuleMapperStatus, nullable: true })
    status: InfraHardwareModuleMapperStatus;
}