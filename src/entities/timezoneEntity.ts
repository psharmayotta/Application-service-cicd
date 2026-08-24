import { Column, Entity } from "typeorm";
import { InferencingEntity } from "./inferenceEntity";

@Entity('v0_dev_yotta.timezone')
export class TimezoneEntity extends InferencingEntity {

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'varchar', length: 50 })
    utc_offset: string;
}