import { Column, Entity } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity({ schema: 'rag', name: 'database_type' })
export class KnowledgeBaseDatabaseTypeEntity extends InferencingEntity {
    @Column({ type: 'varchar', length: 255, nullable: false })
    name: string;

    @Column({ type: 'text', nullable: true })
    icon: string;

    @Column({ type: 'boolean', default: true })
    status: boolean;
}
