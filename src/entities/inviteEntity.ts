import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity('v0_dev_yotta.invites')
export class InviteEntity extends InferencingEntity {

    @Column({ type: 'varchar', length: 100 })
    company_unique_code: string;

    @Column({ type: 'varchar', length: 255 })
    email: string;

    @Column({ type: 'varchar', length: 255 })
    invite_token: string;

    @Column({ type: 'varchar', length: 50, default: 'pending' })
    status: string;

    @Column({ type: 'bigint', nullable: false })
    role_id: number;

    @Column({ type: 'bigint', nullable: false })
    created_by: number;

    @Column({ type: 'int', nullable: false })
    company_member_role_id: number;
}
