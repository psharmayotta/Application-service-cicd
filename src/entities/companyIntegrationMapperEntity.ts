import { Column, Entity } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity({ schema: 'integration', name: 'company_integration_mapper' })
export class CompanyIntegrationMapperEntity extends InferencingEntity {
  @Column({ type: 'integer', nullable: false })
  company_id: number;

  @Column({ type: 'integer', nullable: false })
  integration_id: number;

  @Column({ type: 'boolean', default: false })
  is_active: boolean;
}
