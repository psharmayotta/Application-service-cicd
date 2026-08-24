import { Column, Entity } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity('v0_dev_yotta.roles')
export class RolesEntity extends InferencingEntity {

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;
}
