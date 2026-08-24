import { Column, Entity } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity('v0_dev_yotta.company_member_roles')
export class CompanyMemberRolesEntity extends InferencingEntity {
  @Column({ type: 'int', nullable: true })
  company_id: number | null;

  @Column({ type: 'int', nullable: true })
  member_id: number | null;

  @Column({ type: 'int', nullable: true })
  role_id: number | null;

  @Column({ type: 'boolean', nullable: true })
  default_company: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  active: boolean | null;

  @Column({ type: 'boolean', nullable: true, default: true })
  is_access_active: boolean;
}
