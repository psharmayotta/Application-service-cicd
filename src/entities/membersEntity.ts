import { Column, Entity, Unique, BeforeInsert } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity('v0_dev_yotta.members')
@Unique(['email'])
export class MembersEntity extends InferencingEntity {

  @Column({ type: 'bigint', nullable: false })
  company_id: number;

  @Column({ type: 'varchar', length: 255, nullable: false })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  full_name: string;

  @Column({ type: 'bigint', nullable: false })
  role_id: number;

  @Column({ type: 'varchar', length: 15, nullable: true })
  mobile_no: string;

  @Column({ type: 'text', nullable: true })
  profile_picture: string;

  @Column({ type: 'timestamp', nullable: true })
  last_login: Date;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'boolean', default: true })
  email_verification_pending: boolean;

  @Column({ type: 'boolean', default: false })
  profile_complete: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  user_id: string;


  @Column({ type: 'jsonb', nullable: true, default: {} })
  metadata: any;

  @BeforeInsert()
  generateUserId() {
    if (!this.user_id && this.full_name) {
      const namePart = this.full_name.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      const randomSuffix = Math.random().toString(36).substring(2, 5);
      this.user_id = `${namePart}-${randomSuffix}`;
    } else if (!this.user_id) {
      this.user_id = `user-${Math.random().toString(36).substring(2, 8)}`;
    }
  }
}