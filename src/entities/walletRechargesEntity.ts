import { Entity, Column } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';
import { RechargeStatus } from '../config';

@Entity({ schema: 'price_schema', name: 'wallet_recharges' })
export class WalletRechargeEntity extends InferencingEntity {

    @Column({ type: 'bigint' })
    wallet_id: number;

    @Column({ type: 'bigint' })
    payment_id: number;

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    recharge_amount: number;

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
    bonus_amount: number;

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    total_credit: number;

    @Column({ type: 'enum', enum: RechargeStatus })
    status: RechargeStatus;
}
