import { Column, Entity, } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity({ schema: 'price_schema', name: 'price_plan' })
export class PricePlanEntity extends InferencingEntity {
    @Column({ type: 'varchar', length: 100 })
    plan_name: string;

    @Column({ type: 'timestamp', nullable: true })
    effective_from: Date;

    @Column({ type: 'timestamp', nullable: true })
    effective_to: Date;

    @Column({ type: 'varchar', length: 100, nullable: true })
    currency: string;

    @Column({ type: 'boolean', default: true })
    status: boolean;

    @Column({ type: 'boolean', default: false })
    is_default: boolean;

    @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
    signup_bonus: number;
}
