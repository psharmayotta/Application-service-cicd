import {
    Column,
    Entity,
} from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity({ schema: 'batch_inference', name: 'batch_inference' })
export class BatchInferenceEntity extends InferencingEntity {
    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'int' })
    cloud_provider_id: number;

    @Column({ type: 'int', nullable: true })
    base_model_id: number;

    @Column({ type: 'varchar', length: 255, nullable: true })
    model_class: string;

    @Column({ type: 'text', nullable: true })
    model_path: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    model_type: string;

    @Column({ type: 'int', nullable: true })
    dataset_id: number;

    @Column({ type: 'int', nullable: true })
    secret_id: number;

    @Column({ type: 'jsonb', nullable: true })
    configuration: any;

    @Column({ type: 'int' })
    member_id: number;

    @Column({ type: 'int' })
    company_id: number;

    @Column({ type: 'varchar', length: 50, default: 'none' })
    sync_frequency: string;

    @Column({ type: 'varchar', length: 5, nullable: true })
    sync_time: string;

    @Column({ type: 'varchar', length: 20, nullable: true })
    sync_day: string;

    @Column({ type: 'boolean', default: true })
    is_sync_enabled: boolean;

    @Column({ type: 'timestamp', nullable: true })
    last_run_at: Date;

    @Column({ type: 'timestamp', nullable: true })
    next_run_at: Date;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @Column({ type: 'int', nullable: true })
    cloud_provider: number;

    @Column({ type: 'text', nullable: true })
    storage_path: string;

    @Column({ type: 'int', nullable: true })
    cloud_secret_id: number;
}
