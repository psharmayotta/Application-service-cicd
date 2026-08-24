import { Entity, Column } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';
import { WalletTxnReferenceType, WalletTxnStatus, WalletTxnType } from '../config';

@Entity({ schema: 'price_schema', name: 'wallet_transactions' })
export class WalletTransactionEntity extends InferencingEntity {

    @Column({ type: 'bigint' })
    wallet_id: number;

    @Column({ type: 'enum', enum: WalletTxnType })
    type: WalletTxnType;

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    amount: number;

    @Column({ type: 'enum', enum: WalletTxnReferenceType })
    reference_type: WalletTxnReferenceType;

    @Column({ type: 'varchar', length: 100, nullable: true })
    reference_id: string;

    @Column({ type: 'enum', enum: WalletTxnStatus })
    status: WalletTxnStatus;

    @Column({ type: 'text', nullable: true })
    remarks: string;
}
