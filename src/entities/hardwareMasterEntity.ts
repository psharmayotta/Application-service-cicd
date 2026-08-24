import { Column, Entity } from "typeorm";
import { InferencingEntity } from "./inferenceEntity";
import { HardwareComponentType, StorageType } from "../config";

@Entity({ schema: 'infra_schema', name: 'hardware_master' })
export class HardwareMasterEntity extends InferencingEntity {

    @Column({ type: 'enum', enum: HardwareComponentType, nullable: false })
    component_type: HardwareComponentType;

    @Column({ type: 'varchar', length: 255, nullable: false })
    model_name: string;

    @Column({ type: 'varchar', length: 255, nullable: false })
    manufacturer: string;

    @Column({ type: 'int', nullable: true })
    core_count: number;

    @Column({ type: 'int', nullable: true })
    thread_count: number;

    @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true })
    clock_speed_ghz: number;

    @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
    vram_size_gb: number;

    @Column({ type: 'varchar', length: 50, nullable: true })
    vram_type: string;

    @Column({ type: 'bigint', nullable: true })
    storage_capacity_gb: number;

    @Column({ type: 'enum', enum: StorageType, nullable: true })
    storage_type: StorageType;

}