import { Column, Entity } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';
import { InfraQueueModuleType, InfraQueueStatus } from '../config';

@Entity({ schema: 'infra_schema', name: 'infra_queue' })
export class InfraQueueEntity extends InferencingEntity {

    @Column({ type: 'enum', enum: InfraQueueModuleType, nullable: false })
    module_type: InfraQueueModuleType;

    @Column({ type: 'integer', nullable: false })
    module_id: number;

    @Column({ type: 'integer', nullable: false })
    accelerator_id: number;

    @Column({ type: 'integer', nullable: false, default: 1 })
    accelerator_count: number;

    @Column({ type: 'integer', nullable: true, default: 0 })
    priority: number;

    @Column({ type: 'enum', enum: InfraQueueStatus, default: InfraQueueStatus.PENDING })
    status: InfraQueueStatus;

    @Column({ type: 'jsonb', nullable: false })
    payload: any;

    @Column({ type: 'text', nullable: true })
    error_message: string;

    @Column({ type: 'integer', nullable: true, default: 0 })
    retry_count: number;

    @Column({ type: 'integer', nullable: false })
    company_id: number;

    @Column({ type: 'integer', nullable: false })
    member_id: number;
}
