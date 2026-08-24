import { Column, Entity } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity({ schema: 'rag', name: 'embedding_model' })
export class EmbeddingModelEntity extends InferencingEntity {

    @Column({ type: 'varchar', length: 255, nullable: false })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    model_code: string;

    @Column({ type: 'integer', nullable: false, default: 264 })
    default_vector_dimensions: number;

    @Column({ type: 'text', nullable: true })
    icon: string;

    @Column({ type: 'boolean', nullable: false, default: true })
    status: boolean;
    @Column({ type: 'integer', nullable: true })
    model_max: number;

    @Column({ type: 'integer', nullable: true })
    safe_max: number;

    @Column({ type: 'varchar', length: 255, nullable: true })
    recommended_chunk: string;

    @Column({ type: 'integer', nullable: true })
    max_overlap: number;
}
