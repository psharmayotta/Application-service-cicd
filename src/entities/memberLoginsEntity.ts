import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';
import { MembersEntity } from './membersEntity';

@Entity('v0_dev_yotta.member_logins')
export class MemberLoginsEntity extends InferencingEntity {

  @Column({ type: 'bigint', nullable: false })
  member_id: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  provider: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  provider_user_id: string;

  @Column({ type: 'text', nullable: true })
  access_token: string;

  @Column({ type: 'text', nullable: true })
  refresh_token: string;

  @Column({ type: 'timestamp', nullable: true })
  token_expiry: Date;

  @Column({ type: 'text', nullable: true })
  password: string;

  @ManyToOne(() => MembersEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'member_id' })
  member: MembersEntity;
} 