import { Column, Entity } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity({ schema: 'rag', name: 'deployment_kb_integration' })
export class DeploymentKbIntegrationEntity extends InferencingEntity {

    @Column({ type: 'integer', nullable: false })
    deployment_id: number;

    @Column({ type: 'integer', nullable: false })
    knowledge_base_id: number;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

}
