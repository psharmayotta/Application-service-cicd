import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';
import { RefundStatus } from '../config';

@Entity({ schema: 'price_schema', name: 'wallet_refunds' })
export class WalletRefundEntity extends InferencingEntity {

    @Column({ type: 'bigint' })
    wallet_transaction_id: number;

    @Column({ type: 'bigint' })
    payment_id: number;

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    refund_amount: number;

    @Column({ type: 'text', nullable: true })
    reason: string;

    @Column({ type: 'enum', enum: RefundStatus })
    status: RefundStatus;
}
