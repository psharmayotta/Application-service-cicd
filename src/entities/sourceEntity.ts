import { Column, Entity } from "typeorm";
import { InferencingEntity } from "./inferenceEntity";

@Entity('model.source')
export class SourceEntity extends InferencingEntity {

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'varchar', length: 255 })
    short_description: string;

    @Column({ type: 'boolean', default: true })
    status: boolean;

    @Column({ type: 'text' })
    url: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    model_source_icon: string;
}