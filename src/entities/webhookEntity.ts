import { Column, Entity } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity({ schema: 'integration', name: 'webhook' })
export class WebhookEntity extends InferencingEntity {
  @Column({ type: 'integer', nullable: false })
  company_id: number;

  @Column({ type: 'integer', nullable: true })
  user_id: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;
}
