import {
    Column,
    Entity,
} from 'typeorm';
import { BatchJobStatus } from '../config';
import { InferencingEntity } from './inferenceEntity';

@Entity({ schema: 'batch_inference', name: 'batch_inference_job' })
export class BatchInferenceJobEntity extends InferencingEntity {
    @Column({ type: 'int' })
    inference_id: number;

    @Column({ type: 'enum', enum: BatchJobStatus, default: BatchJobStatus.PENDING })
    status: BatchJobStatus;

    @Column({ type: 'jsonb', nullable: true })
    result: any;

    @Column({ type: 'jsonb', nullable: true })
    configuration: any;

    @Column({ type: 'text', nullable: true })
    report_path: string;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    execution_time: number;

    @Column({ type: 'jsonb', nullable: true })
    progress: any;

    @Column({ type: 'text', nullable: true })
    logs: string;
}
