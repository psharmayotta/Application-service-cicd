import { Column, Entity } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity('v0_dev_admin_yotta.rbac_roles')
export class RbacRolesEntity extends InferencingEntity {

  @Column({ type: 'varchar', length: 255 })
  role_name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'smallint', default: 1 })
  status: number;
}
