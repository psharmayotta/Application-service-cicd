import { Column, Entity } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity({ schema: 'rag', name: 'knowledge_base_source_mapping' })
export class KnowledgeBaseSourceMappingEntity extends InferencingEntity {

    @Column({ type: 'integer', nullable: false })
    knowledge_base_id: number;

    @Column({ type: 'integer', nullable: false })
    source_type_id: number;

    @Column({ type: 'integer', nullable: true })
    cloud_provider_id: number;

    @Column({ type: 'integer', nullable: true })
    cloud_secret_id: number;

    @Column({ type: 'integer', nullable: true })
    region_id: number;

    @Column({ type: 'jsonb', nullable: true })
    source_details: any;

    @Column({ type: 'varchar', length: 50, nullable: false, default: 'active' })
    status: string;

    @Column({ type: 'varchar', length: 255, nullable: false, default: 'PENDING' })
    source_status: string;

    @Column({ type: 'integer', nullable: true })
    member_id: number;

    @Column({ type: 'timestamp', nullable: true })
    last_sync_at: Date;

    @Column({ type: 'timestamp', nullable: true })
    next_sync_at: Date;

}
