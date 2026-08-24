import { Column, Entity, ManyToOne, } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';
import { integer } from 'aws-sdk/clients/cloudfront';
import { ModelClassEntity } from './modelClassEntity';
import { QuantizationEntity } from './quantizationEntity';

@Entity('model_quantization_mapper', { schema: 'model' })
export class ModelQuantizationMapper extends InferencingEntity {
    @Column({ type: 'integer' })
    model_class_id: number;

    @Column({ type: 'integer' })
    quantization_id: number;
}