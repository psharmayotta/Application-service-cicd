import { Column, Entity, } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity({ schema: 'model', name: 'model' })
export class ModelEntity extends InferencingEntity {

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'varchar', length: 50 })
    version: string;

    @Column({ type: 'int' })
    model_libararies_id: number;

    @Column({ type: 'int' })
    model_category_id: number;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'jsonb', nullable: true })
    playground_config: Array<any>;

    @Column({ type: 'int', nullable: true })
    model_gpu_id: number;

    @Column({ type: 'jsonb', nullable: true })
    model_train_configuration: Array<any>;

    @Column({ type: 'int' })
    model_task_id: number;

    @Column({ type: 'int' })
    model_licenses_id: number;

    @Column({ type: 'int' })
    model_provider_id: number;

    @Column({ type: 'int' })
    model_source_id: number;

    @Column({ type: 'varchar', length: 255, nullable: true })
    model_source_repo: string;

    @Column({ type: 'text', nullable: true })
    model_detail: string;

    @Column({ type: 'int', nullable: true })
    model_type_id: number;

    @Column({ type: 'boolean', default: false })
    allow_training: boolean;

    @Column({ type: 'boolean', default: false })
    allow_playground: boolean;

    @Column({ type: 'varchar', length: 255, nullable: true })
    model_image: string;

    @Column({ type: 'text', nullable: true })
    model_suggestion: string;

    @Column({ type: 'int', nullable: true })
    model_rank: number;

    @Column({ type: 'jsonb', nullable: true })
    model_input: Array<any>;

    @Column({ type: 'jsonb', nullable: true })
    model_output: Array<any>;

    @Column({ type: 'int', nullable: true })
    cloud_provider_id: number;

    @Column({ type: 'int', nullable: true })
    cloud_secret_id: number;

    @Column({ type: 'int', nullable: true })
    model_class_id: number;

    @Column({ type: 'int', nullable: true })
    cloud_account_id: number;

    @Column({ type: 'int', nullable: true })
    region_id: number;

    @Column({ type: 'int', nullable: true })
    accelerator_count: number;

    @Column({ type: 'int', nullable: true })
    accelerator_id: number;   //hardwareSpecs ID

    @Column({ type: 'int', nullable: true })
    machine_id: number;

    @Column({ type: 'int', nullable: true })
    quantization_id: number;

    @Column({ type: 'jsonb', nullable: true })
    optimization_configuration: any;

    @Column({ type: 'jsonb', nullable: true })
    model_configuration: any;

    @Column({ type: 'jsonb', nullable: true })
    pipeline_configuration: any;

    @Column({ type: 'text', nullable: true })
    status: string;

    @Column({ type: 'int', nullable: true, default: 0 })
    execution_time: number;

    @Column({ type: 'int', nullable: true })
    member_id: number;

    @Column({ type: 'int', nullable: true })
    company_id: number;

    @Column({ type: 'text', nullable: true })
    model_unique_key: string;

    @Column({ type: 'jsonb', nullable: true })
    data_set_configuration: any;

    @Column({ type: 'varchar', nullable: true })
    quantization_endpoint: string;

    @Column({ type: 'int', nullable: true })
    training_id: number;

    @Column({ type: 'boolean', default: false })
    is_compiled: boolean;

    @Column({ type: 'boolean', default: false })
    is_docker: boolean;

    @Column({ type: 'smallint', nullable: true })
    popular_models: number;

    @Column({ type: 'smallint', nullable: true })
    new_models: number;

    @Column({ type: 'varchar', length: 255, nullable: true })
    input_tokens: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    output_tokens: string;

    @Column({ type: 'int', nullable: true })
    contex: number;

    @Column({ type: 'int', nullable: true })
    parameters: number;


    @Column({ type: 'boolean', nullable: true })
    is_suggetion: boolean;

    @Column({ type: 'jsonb', nullable: true })
    supported_features: any;

    @Column({ type: 'jsonb', nullable: true })
    input_data_format_support: any;

    @Column({ type: 'jsonb', nullable: true })
    output_data_format_support: any;

    @Column({ type: 'jsonb', nullable: true })
    supported_languages: any;

    @Column({ type: 'jsonb', nullable: true })
    model_developer_and_architecture: any;

    @Column({ type: 'timestamptz', nullable: true })
    new_models_due_date: Date;

    @Column({ type: 'jsonb', nullable: true })
    model_docs_ids: Array<number>;

    @Column({ type: 'varchar', length: 255, nullable: true })
    per_image_tokens: string;

    @Column({ type: 'jsonb', nullable: true, default: [] })
    status_log: any[];

    @Column({ type: 'text', nullable: true })
    sample_dataset_path: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    registry: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    docker_image_url: string;

    @Column({ type: 'int', nullable: true })
    host_provider: number;

    @Column({ type: 'int', nullable: true })
    cpu_request: number;

    @Column({ type: 'int', nullable: true })
    cpu_limit: number;

    @Column({ type: 'int', nullable: true })
    memory_request: number;

    @Column({ type: 'int', nullable: true })
    memory_limit: number;

    @Column({ type: 'jsonb', nullable: true })
    overall_configuration: any;

    @Column({ type: 'boolean', default: false })
    enable_grpc: boolean;
}
