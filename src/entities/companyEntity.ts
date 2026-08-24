import { Column, Entity, Unique } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity('v0_dev_yotta.company')
@Unique(['company_email'])
@Unique(['company_name'])
export class CompanyEntity extends InferencingEntity {

  @Column({ type: 'varchar', length: 36, unique: true })
  company_unique_code: string;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  company_unique_id: string;

  @Column({ type: 'varchar', length: 255, nullable: false, unique: true })
  company_name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  industry: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  company_email: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'int' })
  price_plan_id: number;

  @Column({ type: 'bigint', nullable: true })
  created_by: number;

  @Column({ type: 'boolean', default: false })
  is_kyc: boolean;

  @Column({ type: 'jsonb', nullable: true, default: {} })
  metadata: any;
}
