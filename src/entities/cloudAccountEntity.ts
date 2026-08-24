import { Column, Entity } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';
import { CloudAccountOwnership } from '../config';

@Entity('infra_schema.cloud_account')
export class CloudAccountEntity extends InferencingEntity {

    @Column({ type: 'text', nullable: false })
    account_name: string;

    @Column({ type: 'integer', nullable: false })
    company_id: number;

    @Column({ type: 'integer', nullable: false })
    member_id: number;

    @Column({ type: 'integer', nullable: false })
    cloud_provider_id: number;

    @Column({ type: 'integer', nullable: false })
    cloud_region_id: number;

    @Column({ type: 'integer', nullable: false })
    cloud_secret_id: number;

    @Column({ type: 'enum', enum: CloudAccountOwnership, default: CloudAccountOwnership.PRIVATE, nullable: true })
    ownership: CloudAccountOwnership;

    @Column({ type: 'boolean', default: true, nullable: true })
    status: boolean;

    @Column({ type: 'boolean', default: false, nullable: true })
    is_default: boolean;
}
