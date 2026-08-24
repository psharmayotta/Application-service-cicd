import { Column, Entity } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity('infra_schema.hosted_zone')
export class HostedZoneEntity extends InferencingEntity {

    @Column({ type: 'text', nullable: false })
    hosted_zone_name: string;

    @Column({ type: 'integer', nullable: false })
    company_id: number;

    @Column({ type: 'integer', nullable: false })
    member_id: number;

    @Column({ type: 'integer', nullable: false })
    cloud_account_id: number;

    @Column({ type: 'text', nullable: false })
    sub_domain: string;

    @Column({ type: 'text', nullable: false })
    domain: string;

    @Column({ type: 'text', nullable: false })
    full_domain: string;

    @Column({ type: 'text', nullable: false })
    zone_id: string;

    @Column({ type: 'boolean', default: false, nullable: true })
    status: boolean;
}
