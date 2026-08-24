import { Column, Entity, } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity({ schema: 'module_schema', name: 'modules' })
export class InfraModuleEntity extends InferencingEntity {
    @Column({ type: 'varchar', length: 100 })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'boolean', default: false })
    allocated_infra: boolean;
}