import { Entity, Column } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';
import { WebhookPlatform } from '../config';

@Entity({ schema: 'integration', name: 'webhook_configs' })
export class WebhookConfigEntity extends InferencingEntity {

  @Column({ type: 'int', nullable: false })
  company_id: number;

  @Column({ type: 'int', nullable: true })
  user_id: number;

  @Column({ type: 'varchar', length: 255, nullable: false })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  platform: WebhookPlatform;

  @Column({ type: 'jsonb', nullable: false, default: {} })
  config: any;

  @Column({ type: 'jsonb', nullable: false, default: [] })
  events: string[];

  @Column({ type: 'boolean', default: true })
  is_active: boolean;
}
