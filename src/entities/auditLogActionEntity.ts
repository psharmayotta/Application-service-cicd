import { Column, Entity } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity({ schema: 'audit_log', name: 'actions' })
export class AuditLogActionEntity extends InferencingEntity {
    @Column({ type: 'varchar', length: 50, nullable: false, unique: true })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;
}
