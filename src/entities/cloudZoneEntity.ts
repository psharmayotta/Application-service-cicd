import { Column, Entity } from "typeorm";
import { InferencingEntity } from "./inferenceEntity";

@Entity({ schema: 'infra_schema', name: 'cloud_zone' })
export class CloudZoneEntity extends InferencingEntity {

    @Column({ type: 'int', nullable: false })
    c_provider_id: number;

    @Column({ type: 'text', nullable: false })
    name: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    cloud_zone_code: string;

    @Column({ type: 'boolean', default: true, nullable: false })
    status: boolean;

    @Column({ type: 'int', nullable: true })
    country_id: number;

    @Column({ type: 'text', nullable: true })
    cloud_zone_image: string;
}