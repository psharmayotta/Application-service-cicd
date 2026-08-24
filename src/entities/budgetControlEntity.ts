import { Entity, Column } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity({ schema: 'price_schema', name: 'budget_control' })
export class BudgetControlEntity extends InferencingEntity {

  @Column({ type: 'int', nullable: false })
  company_id: number;

  @Column({ type: 'bigint', nullable: true })
  user_id: number;

  @Column({ type: 'varchar', length: 255, nullable: false })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  type: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: false })
  budget: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  threshold_alert_1: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  threshold_alert_2: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  threshold_alert_3: number;

  @Column({ name: 'auto_stop_resources', type: 'boolean', default: false })
  auto_stop_resources: boolean;

  @Column({ name: 'is_custom_threshold', type: 'boolean', default: false })
  is_custom_threshold: boolean;
}
