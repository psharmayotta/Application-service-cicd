import { Column, Entity, } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity('model.model_class')
export class ModelClassEntity extends InferencingEntity {
    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'varchar', length: 255 })
    abb: string;

    @Column({ type: 'jsonb', nullable: true })
    optimization_configuration: string;

    @Column({ type: 'jsonb', nullable: true })
    model_configuration: string;

    @Column({ type: 'jsonb', nullable: true })
    pipeline_configuration: string;

    @Column({ type: 'jsonb', nullable: true })
    scaling_materic: any;
}