import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity('infra_schema.cloud_secrets')
export class CloudSecretsEntity extends InferencingEntity {

    @Column({ type: 'text' })
    name: string;

    @Column({ type: 'int', nullable: true })
    c_provider_id: number;

    @Column({ type: 'int', nullable: true })
    cloud_service_id: number;

    @Column({ type: 'json', nullable: true })
    secrets: any;

    @Column({ type: 'int', nullable: true })
    company_id: number;

    @Column({ type: 'int', nullable: true })
    member_id: number;

    @Column({ type: 'boolean', default: false })
    status: boolean;

    @Column({ type: 'timestamp', nullable: true })
    last_used_at: Date;

    @Column({ type: 'varchar', length: 100, nullable: true })
    last_used_by_module: string;
}
