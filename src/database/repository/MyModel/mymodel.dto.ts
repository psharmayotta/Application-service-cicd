import { IsString, IsOptional, MaxLength, IsNotEmpty, Length, ValidateIf, IsNumber } from "class-validator";
import { Transform } from "stream";

export class MyModelDto {
    @ValidateIf((object, value) => object.id !== undefined)
    @IsNotEmpty({ 'message': 'Model id is required' })
    id!: number;

    @IsString()
    @IsNotEmpty({ 'message': "Name is required" })
    @Length(2, 100, { message: 'Name must be between 2 and 100 characters' })
    name!: string;


    @IsString()
    description!: string;

    @ValidateIf(o => !o.docker_image_url)
    @IsString()
    model_source_repo!: string;

    @IsNumber()
    cloud_provider_id!: number;

    @IsNumber()
    @IsOptional()
    cloud_secret_id!: number;

    @ValidateIf(o => !o.docker_image_url)
    @IsNumber()
    model_class_id!: number;

    @IsNumber()
    cloud_account_id!: number;

    @IsNumber()
    region_id: number;

    @IsNumber()
    accelerator_count: number;

    @IsNumber()
    accelerator_id!: number;

    @IsNumber()
    machine_type_id!: number;

    @ValidateIf(o => !o.docker_image_url)
    @IsNumber()
    quantization_id!: number;

    model_configuration: any;

    optimization_configuration: any;

    pipeline_configuration: any;

    @IsNumber()
    company_id: number;

    @IsNumber()
    @IsOptional()
    training_id!: number;

    @IsOptional()
    is_compiled: boolean;

    @IsString()
    @IsOptional()
    registry: string;

    @IsString()
    @IsOptional()
    docker_image_url: string;

    @IsNumber()
    @IsOptional()
    host_provider: number;

    @IsNumber()
    @IsOptional()
    cpu_request: number;

    @IsNumber()
    @IsOptional()
    cpu_limit: number;

    @IsNumber()
    @IsOptional()
    memory_request: number;

    @IsNumber()
    @IsOptional()
    memory_limit: number;

    @IsOptional()
    overall_configuration: any;
} 