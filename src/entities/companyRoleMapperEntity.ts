import { Column, Entity } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

// Maps companies to available roles
@Entity('v0_dev_yotta.company_role_mapper')
export class CompanyRoleMapperEntity extends InferencingEntity {
  @Column({ type: 'bigint', nullable: false })
  company_id: number;

  @Column({ type: 'int', nullable: false })
  role_id: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @Column({ type: 'boolean', default: true })
  active: boolean;
}
