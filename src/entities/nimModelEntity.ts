import { Column, Entity } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity({ schema: 'model', name: 'nim_model' })
export class NimModelEntity extends InferencingEntity {

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'text' })
    image: string;

    @Column({ type: 'varchar', length: 255 })
    publisher: string;

    @Column({ type: 'varchar', length: 255 })
    category: string;

    @Column({ type: 'int', nullable: true })
    model_provider_id: number;

    @Column({ type: 'boolean', default: true })
    status: boolean;

    @Column({ type: 'jsonb', nullable: true })
    model_input: any;

    @Column({ type: 'varchar', length: 255, nullable: true })
    model_identifier: string;
}
