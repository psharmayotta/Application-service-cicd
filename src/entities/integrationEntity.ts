import { Column, Entity } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity({ schema: 'integration', name: 'integrations' })
export class IntegrationEntity extends InferencingEntity {
  @Column({ type: 'varchar', length: 100, nullable: false })
  integration_name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  icon: string;
}
