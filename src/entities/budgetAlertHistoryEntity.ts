import { Entity, Column } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity({ schema: 'price_schema', name: 'budget_alert_history' })
export class BudgetAlertHistoryEntity extends InferencingEntity {

  @Column({ type: 'int', nullable: false })
  budget_control_id: number;

  @Column({ type: 'int', nullable: false })
  company_id: number;

  @Column({ type: 'int', nullable: false })
  threshold_level: number;

  @Column({ type: 'varchar', length: 20, nullable: false })
  alert_period: string;

  @Column({ type: 'date', nullable: false, default: () => 'CURRENT_DATE' })
  alert_date: Date;

  @Column({ type: 'boolean', default: false })
  is_seen: boolean;
}
