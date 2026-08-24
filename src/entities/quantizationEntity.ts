import { Column, Entity } from "typeorm";
import { InferencingEntity } from "./inferenceEntity";
import { Json } from "aws-sdk/clients/robomaker";

@Entity({ schema: 'model', name: 'quantization' })
export class QuantizationEntity extends InferencingEntity {

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'varchar', length: 255 })
    short_description: string;

    @Column({ type: 'boolean', default: true })
    status: boolean;

    @Column({ type: 'int' })
    precision: number;

    @Column({ type: 'jsonb', nullable: true })
    optimization_configuration: Json;

    @Column({ type: 'jsonb', nullable: true })
    model_configuration: Json;

    @Column({ type: 'jsonb', nullable: true })
    pipeline_configuration: Json;

}