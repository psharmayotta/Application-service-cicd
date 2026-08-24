import { Column, Entity } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';
import { KnowledgeBaseJobStatus } from '../config';

@Entity({ schema: 'rag', name: 'knowledge_base_job' })
export class KnowledgeBaseJobEntity extends InferencingEntity {

    @Column({ type: 'integer', nullable: false })
    knowledge_base_id: number;

    @Column({ type: 'integer', nullable: false })
    company_id: number;

    @Column({ type: 'varchar', length: 50, nullable: false, default: KnowledgeBaseJobStatus.PENDING })
    status: KnowledgeBaseJobStatus;

    @Column({ type: 'integer', nullable: true })
    files_processed: number;

    @Column({ type: 'integer', nullable: true })
    files_failed: number;

    @Column({ type: 'integer', nullable: true })
    vectors_stored: number;

    @Column({ type: 'jsonb', nullable: true })
    processed_files: string[];

    @Column({ type: 'jsonb', nullable: true })
    failed_files: string[];

    @Column({ type: 'text', nullable: true })
    failure_message: string;

    @Column({ type: 'bigint', nullable: true })
    total_content_size_bytes: number;
}
