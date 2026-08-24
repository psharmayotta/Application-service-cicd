import { ArrayNotEmpty, IsArray, IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { NodeAntiAffinity, DeploymentType } from '../../../config';

export class DeploymentDto {

    @IsOptional()
    @IsNumber()
    id?: number;

    @IsArray()
    @IsOptional()
    node_groups?: Array<number>;

    @IsNumber()
    @IsNotEmpty({ message: 'Company is required' })
    company_id!: number;

    @IsNumber()
    @IsNotEmpty({ message: 'Model is requried' })
    model_id!: number;

    @IsNumber()
    @IsNotEmpty({ message: 'Cluster is requried' })
    cluster_id!: number;

    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString()
    @IsNotEmpty({ message: 'Deployment name is required' })
    deployment_name!: string;

    @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
    @IsOptional()
    @IsEnum(DeploymentType, { message: 'deployment_type must be a valid enum value: playground, mymodel, training, docker' })
    deployment_type?: DeploymentType;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    gpu_type?: string;

    @IsOptional()
    @IsNumber()
    cpu_cores?: number;

    @IsOptional()
    gpu_count_per_pod?: number | string;

    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString()
    @IsOptional()
    @Matches(/^\S*$/, { message: 'slug must not contain spaces' })
    slug?: string;

    @IsOptional()
    scaling?: any;

    @IsOptional()
    @IsNumber()
    min_pod_count?: number;

    @IsOptional()
    @IsNumber()
    max_pod_count?: number;

    @IsOptional()
    @IsArray()
    scaling_metric?: any[];

    @IsOptional()
    @IsEnum(NodeAntiAffinity, { message: 'node_anti_affinity must be one of: required, notrequired, preferred' })
    node_anti_affinity?: NodeAntiAffinity;

    @IsOptional()
    @IsBoolean({ message: 'rapid_autoscaling must be a boolean value' })
    rapid_autoscaling?: boolean;
}

export class UpdateDeploymentStatusDto {
    @IsNumber()
    @IsNotEmpty({ message: 'ID is required' })
    id!: number;

    @IsString()
    @IsNotEmpty({ message: 'Status is required' })
    status!: string;
}

