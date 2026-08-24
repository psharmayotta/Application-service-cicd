import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';
import { RolesEntity } from './rolesEntity';
import { ModulesEntity } from './modulesEntity';

@Entity('v0_dev_yotta.role_module_permission')
export class RoleModulePermissionEntity extends InferencingEntity {

  @Column({ type: 'int', nullable: false })
  role_id: number;

  @Column({ type: 'int', nullable: false })
  module_id: number;

  @Column({ type: 'boolean', default: false })
  can_view: boolean;

  @Column({ type: 'boolean', default: false })
  can_edit: boolean;

  @Column({ type: 'boolean', default: false })
  can_delete: boolean;

  @Column({ type: 'boolean', default: false })
  can_create: boolean;

  @ManyToOne(() => RolesEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: RolesEntity;

  @ManyToOne(() => ModulesEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'module_id' })
  module: ModulesEntity;
} 