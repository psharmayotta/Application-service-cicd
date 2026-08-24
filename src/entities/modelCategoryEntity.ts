import { Column, Entity, } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity({ schema: 'model', name: 'model_category' })
export class ModelCategoryEntity extends InferencingEntity {

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'boolean', default: true })
    status: boolean;

    @Column({ type: 'varchar', length: 255, nullable: true })
    model_category_icon: string;

    @Column({ type: 'boolean', default: false })
    is_benchmarking: boolean;
}
