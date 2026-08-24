import { Entity, Column } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';
import { WalletStatus } from '../config';

@Entity({ schema: 'price_schema', name: 'wallet' })
export class WalletEntity extends InferencingEntity {

    @Column({ type: 'bigint' })
    user_id: number;

    @Column({ type: 'int', nullable: true })
    company_id: number;

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.0 })
    balance: number;

    @Column({ type: 'varchar', length: 10 })
    currency: string;

    @Column({ type: 'enum', enum: WalletStatus, default: WalletStatus.ACTIVE })
    status: WalletStatus;

    @Column({ type: 'bigint', nullable: true })
    last_transaction_id: number;

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.0 })
    threshold_limit: number;

    @Column({ type: 'decimal', precision: 5, scale: 2, default: 0.0 })
    threshold_perc: number;

    @Column({ type: 'timestamp', nullable: true })
    expiry_date: Date;
}