import { Entity, Column } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';
import { PaymentGateway, PaymentStatus } from '../config';

@Entity({ schema: 'price_schema', name: 'payment_transactions' })
export class PaymentTransactionEntity extends InferencingEntity {

    @Column({ type: 'bigint' })
    user_id: number;

    @Column({ type: 'varchar', length: 100, nullable: true })
    order_id: string;

    @Column({ type: 'enum', enum: PaymentGateway })
    payment_gateway: PaymentGateway;

    @Column({ type: 'varchar', length: 255, nullable: true })
    payment_reference: string;

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    amount: number;

    @Column({ type: 'varchar', length: 10 })
    currency: string;

    @Column({ type: 'enum', enum: PaymentStatus })
    status: PaymentStatus;

    @Column({ type: 'varchar', length: 255, nullable: true })
    checksum: string;

    @Column({ type: 'jsonb', nullable: true })
    response_payload: object;
}
