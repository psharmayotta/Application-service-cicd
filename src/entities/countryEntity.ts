import { Column, Entity } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity('geo_schema.countries')
export class CountryMasterEntity extends InferencingEntity {

    @Column({ type: 'varchar', length: 150, nullable: false })
    country_name: string;

    @Column({ type: 'text', nullable: true })
    country_flag_image: string;

    @Column({ type: 'varchar', length: 100, nullable: false })
    currency_name: string;

    @Column({ type: 'varchar', length: 50, nullable: false })
    currency_code: string;

    @Column({ type: 'varchar', length: 50, nullable: true })
    phone_code: string;
}
