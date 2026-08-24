import { Column, Entity } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity({ schema: 'integration', name: 'webhook_integrated_platforms' })
export class WebhookIntegratedPlatformEntity extends InferencingEntity {
  @Column({ type: 'integer', nullable: false })
  webhook_id: number;

  @Column({ type: 'integer', nullable: false })
  platform_id: number;

  @Column({ type: 'jsonb', nullable: false, default: {} })
  config: any;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'jsonb', nullable: false, default: [] })
  events: string[];
}
