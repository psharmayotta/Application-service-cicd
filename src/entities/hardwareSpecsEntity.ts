import { Column, Entity } from "typeorm";
import { InferencingEntity } from "./inferenceEntity";
import { HardwareComponentType, StorageType } from "../config";

@Entity({ schema: 'infra_schema', name: 'hardware_specs' })
export class HardwareSpecsEntity extends InferencingEntity {

    @Column({ type: 'int', nullable: true })
    hardware_master_id: number

    @Column({ type: 'varchar', length: 50, nullable: true })
    interface: string;

    // @Column({ type: 'int', nullable: true })
    // tdp_watt: number;

    // @Column({ type: 'int', nullable: true })
    // release_year: number;

    @Column({ type: 'jsonb', nullable: true })
    extra_specs: number;

    @Column({ type: 'text', nullable: true })
    vlan_id: string;

    @Column({ type: 'int', nullable: true })
    region_id: number;

    @Column({ type: 'int', nullable: true })
    zone_id: number;

    @Column({ type: 'int', nullable: true })
    cloud_provider_id: number;

}