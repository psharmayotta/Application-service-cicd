import { Column, Entity } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity({ schema: 'audit_log', name: 'modules' })
export class AuditLogModuleEntity extends InferencingEntity {
    @Column({ type: 'varchar', length: 100, nullable: false, unique: true })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;
}
