import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';
import { AuditLogModuleEntity } from './auditLogModuleEntity';
import { AuditLogActionEntity } from './auditLogActionEntity';

@Entity({ schema: 'audit_log', name: 'audit_logs' })
export class AuditLogEntity extends InferencingEntity {

    @Column({ type: 'integer', nullable: false })
    company_id: number;

    @Column({ type: 'integer', nullable: false })
    member_id: number;

    @Column({ type: 'integer', nullable: false })
    module_id: number;

    @ManyToOne(() => AuditLogModuleEntity)
    @JoinColumn({ name: 'module_id' })
    module: AuditLogModuleEntity;

    @Column({ type: 'integer', nullable: false })
    action_id: number;

    @ManyToOne(() => AuditLogActionEntity)
    @JoinColumn({ name: 'action_id' })
    action: AuditLogActionEntity;

    @Column({ type: 'varchar', length: 100, nullable: true })
    entity_type: string;

    @Column({ type: 'integer', nullable: true })
    entity_id: number;

    @Column({ type: 'varchar', length: 500, nullable: true })
    entity_name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'jsonb', nullable: true, default: {} })
    metadata: any;

    @Column({ type: 'varchar', length: 45, nullable: true })
    ip_address: string;
}
