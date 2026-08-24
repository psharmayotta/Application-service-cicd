import { Column, Entity, } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';
import { ModelTrainingStatus, TrainingType } from '../config';
import { integer } from 'aws-sdk/clients/cloudfront';

@Entity('model_training', { schema: 'model' })
export class ModelTrainingEntity extends InferencingEntity {

    @Column({ type: 'integer', nullable: false })
    company_id: number;

    @Column({ type: 'integer', nullable: false })
    member_id: number;

    @Column({ type: 'integer', nullable: false })
    model_id: number;

    @Column({ type: 'integer', nullable: true })
    dataset_id: number;

    @Column({ type: 'varchar', nullable: false })
    name: string;

    @Column({ type: 'text', nullable: false })
    description: string;

    @Column({ type: 'integer', nullable: false })
    model_category_id: integer;

    @Column({ type: 'integer', nullable: false })
    cloud_provider_id: integer;

    @Column({ type: 'jsonb', nullable: false })
    train_configuration: any;

    @Column({ type: 'integer', nullable: false })
    model_task_type_id: integer;


    @Column({ type: 'jsonb', nullable: true })
    dataset_configuration: any;

    @Column({ type: 'integer', nullable: false })
    infra_allocation_id: number;

    @Column({ type: 'varchar', nullable: false })
    request_id: string;

    @Column({ type: 'varchar', nullable: false })
    job_id: string;

    @Column({ type: 'integer', nullable: false })
    execution_time: number;

    @Column({ type: 'varchar', length: 50, nullable: false, default: ModelTrainingStatus.PENDING })
    status: ModelTrainingStatus;

    @Column({ type: 'jsonb', nullable: false })
    infra_detail: any;

    @Column({ type: 'varchar', length: 50, nullable: false, default: TrainingType.SUPERVISED })
    training_type: TrainingType;

    @Column({ type: 'integer', nullable: true })
    accelerator_id: number;

    @Column({ type: 'integer', nullable: true, default: 1 })
    accelerator_count: number;

    @Column({ type: 'jsonb', nullable: true })
    evaluation_details: any;

    @Column({ type: 'jsonb', nullable: true })
    deployment_details: any;

    @Column({ type: 'jsonb', nullable: true, default: [] })
    status_log: any[];
}
