import { Column, Entity } from "typeorm";
import { InferencingEntity } from "./inferenceEntity";

@Entity('model.model_gpu_mapper')
export class ModelGpuMapperEntity extends InferencingEntity {

    @Column({ type: 'integer' })
    inference_id: number;

    @Column({ type: 'integer' })
    model_id: number;
}