import { Column, Entity, } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity('training_weights', { schema: 'model' })
export class TrainingWeightsEntity extends InferencingEntity {

    @Column({ type: 'integer', nullable: false })
    training_id: number;

    @Column({ type: 'integer', nullable: false })
    secret_id: number;

    @Column({ type: 'text', nullable: false })
    path: string;

    @Column({ type: 'integer', nullable: false })
    cloud_provider: number;

    @Column({ type: 'varchar', nullable: false, default: 'PENDING' })
    status: string;
}
