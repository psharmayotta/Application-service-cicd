import { Column, Entity } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity({ schema: 'rag', name: 'knowledge_base_source' })
export class KnowledgeBaseSourceEntity extends InferencingEntity {
    @Column({ type: 'varchar', length: 255, nullable: false })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'varchar', length: 100, nullable: false })
    type: string;

    @Column({ type: 'text', nullable: true })
    icon: string;

    @Column({ type: 'boolean', default: true })
    status: boolean;
}
