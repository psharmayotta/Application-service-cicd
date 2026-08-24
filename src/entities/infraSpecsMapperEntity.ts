import { Column, Entity } from "typeorm";
import { InferencingEntity } from "./inferenceEntity";

@Entity({ schema: 'infra_schema', name: 'infra_specs_mapper' })
export class InfraSpecsMapperEntity extends InferencingEntity {

    @Column({ type: 'int', nullable: false })
    node_id: number;

    @Column({ type: 'int', nullable: false })
    hardware_specs_id: number;

    @Column({ type: 'timestamp', nullable: true })
    config_date: Date;

    @Column({ type: 'text', nullable: true })
    notes: string;

    @Column({ type: 'text', nullable: true })
    os: string;
}