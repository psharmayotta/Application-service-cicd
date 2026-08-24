import { Column, Entity } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';
import { ChunkingType, KnowledgeBaseSourceType, KnowledgeBaseStatus } from '../config';

@Entity({ schema: 'rag', name: 'knowledge_base' })
export class KnowledgeBaseEntity extends InferencingEntity {

    @Column({ type: 'integer', nullable: false })
    company_id: number;

    @Column({ type: 'integer', nullable: false })
    member_id: number;

    @Column({ type: 'varchar', length: 255, nullable: false })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'integer', nullable: false })
    source_type_id: number;

    @Column({ type: 'integer', nullable: true })
    cloud_provider_id: number;

    @Column({ type: 'integer', nullable: true })
    cloud_secret_id: number;

    @Column({ type: 'integer', nullable: true })
    region_id: number;

    @Column({ type: 'boolean', nullable: false, default: false })
    auto_sync: boolean;

    @Column({ type: 'varchar', length: 50, nullable: true })
    sync_frequency: string;

    @Column({ type: 'jsonb', nullable: true })
    chunking_details: any;

    @Column({ type: 'varchar', length: 50, nullable: true })
    chunking_type: ChunkingType;

    @Column({ type: 'varchar', length: 10, nullable: true })
    sync_time: string;

    @Column({ type: 'integer', nullable: true })
    sync_day: number;

    @Column({ type: 'timestamp', nullable: true })
    last_sync_at: Date;

    @Column({ type: 'timestamp', nullable: true })
    next_sync_at: Date;

    @Column({ type: 'varchar', length: 50, nullable: false, default: KnowledgeBaseStatus.PENDING })
    status: KnowledgeBaseStatus;

    @Column({ type: 'text', nullable: true })
    failure_message: string;

    @Column({ type: 'jsonb', nullable: true })
    embedding_details: any;

    @Column({ type: 'integer', nullable: true })
    embedding_model_id: number;

    @Column({ type: 'jsonb', nullable: true })
    vector_store_details: any;

    @Column({ type: 'integer', nullable: true })
    vector_store_id: number;

    @Column({ type: 'jsonb', nullable: true })
    source_details: any;
}
