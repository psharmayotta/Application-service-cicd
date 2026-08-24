import { Column, Entity } from "typeorm";
import { InferencingEntity } from "./inferenceEntity";

@Entity({ schema: 'infra_schema', name: 'cloud_provider' })
export class CloudProviderEntity extends InferencingEntity {

    @Column({ type: 'text', nullable: false })
    name: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    cloud_code: string;

    @Column({ type: 'boolean', default: true, nullable: false })
    status: boolean;

    @Column({ type: 'jsonb', nullable: true })
    secret_template: any;

    @Column({ type: 'boolean', default: true, nullable: false })
    cloud_account_activation: boolean;

    @Column({ type: 'boolean', default: true, nullable: false })
    cloud_secret_activation: boolean;

    @Column({ type: 'varchar', length: 255, nullable: true })
    cloud_provider_image: string;

    @Column({ type: 'boolean', default: true, nullable: false })
    my_model_activation: boolean;

    @Column({ type: 'boolean', default: true, nullable: false })
    training_activation: boolean;

    @Column({ type: 'boolean', default: true, nullable: false })
    compile_activation: boolean;

    @Column({ type: 'boolean', default: true, nullable: false })
    rag_activation: boolean;

    @Column({ type: 'boolean', default: false })
    is_default: boolean;

    @Column({ type: 'boolean', default: true, nullable: false })
    benchmarking_activation: boolean;
}
