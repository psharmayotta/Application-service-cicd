import { Column, Entity, } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity('model.model_task')
export class ModelTaskEntity extends InferencingEntity {

    @Column({ type: 'integer' })
    model_category_id: number;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'boolean', default: true })
    status: boolean;

    @Column({ type: 'varchar', length: 255, nullable: true })
    model_task_icon: string;
}
