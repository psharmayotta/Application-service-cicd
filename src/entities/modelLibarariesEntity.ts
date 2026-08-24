import { Column, Entity, } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity('model.model_libararies')
export class ModelLibarariesEntity extends InferencingEntity {
    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'boolean', default: true })
    status: boolean;

    @Column({ type: 'varchar', length: 255, nullable: true })
    model_libararies_icon: string;
}
