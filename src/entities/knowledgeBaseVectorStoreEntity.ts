import { Column, Entity } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity({ schema: 'rag', name: 'knowledge_base_vector_store' })
export class KnowledgeBaseVectorStoreEntity extends InferencingEntity {
    @Column({ type: 'varchar', length: 255, nullable: false })
    name: string;

    @Column({ type: 'text', nullable: true })
    icon: string;

    @Column({ type: 'boolean', default: false })
    coming_soon: boolean;

    @Column({ type: 'boolean', default: true })
    status: boolean;
}
