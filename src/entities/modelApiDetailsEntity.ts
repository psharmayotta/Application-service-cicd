import { Column, Entity, } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';
import { APILangauge } from '../config';

@Entity({ schema: 'model', name: 'model_api_details' })
export class ModelAPIDetailsEntity extends InferencingEntity {
    @Column({ type: 'int', nullable: false })
    model_id: number;

    @Column({ type: 'enum', enum: APILangauge, default: APILangauge.PYTHON })
    language: APILangauge;

    @Column({ type: 'jsonb', nullable: true })
    steps: Array<any>;

    @Column({ type: 'varchar', length: 50, default: 'model' })
    module_type: string;
}
