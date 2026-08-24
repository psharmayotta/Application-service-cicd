import { Transform, Type } from "class-transformer";
import { IsString, ValidateIf, IsNotEmpty, IsNumber, IsEnum, IsOptional, IsObject, IsDate } from "class-validator";
import { InfraAllocationModuleType, InfraAllocationStatus } from "../../../config";

export class AllocationDto {
    @ValidateIf((o, v) => o.id !== undefined)
    @IsNumber()
    @IsNotEmpty({ message: 'Allocation id is required' })
    id!: number;

    @IsOptional()
    @IsNumber()
    node_id?: number;

    @IsOptional()
    @IsNumber()
    module_id?: number;

    @IsOptional()
    @IsEnum(InfraAllocationModuleType)
    module_type?: InfraAllocationModuleType;

    @IsOptional()
    @IsNumber()
    user_id?: number;

    @IsOptional()
    @IsNumber()
    company_id?: number;

    @IsOptional()
    @IsNumber()
    hardware_specs_id?: number;

    @IsOptional()
    @IsNumber()
    vram_size_gb?: number;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    allocation_time?: Date;

    @IsOptional()
    @IsEnum(InfraAllocationStatus)
    status?: InfraAllocationStatus;

    @IsOptional()
    @IsString()
    model_endpoint?: string;

    @IsOptional()
    @IsString()
    model_grpc?: string;

    @IsOptional()
    @IsString()
    model_proxy?: string;

    @IsOptional()
    @IsString()
    model_grpc_proto?: string;

    @IsOptional()
    @IsString()
    model_protocol?: string;

    @IsOptional()
    @IsNumber()
    module_type_id?: number;

    @IsOptional()
    @IsString()
    deployment_name?: string;

    @IsOptional()
    @IsString()
    slug?: string;

    @IsOptional()
    @IsNumber()
    cluster_id?: number;

    @IsOptional()
    @IsObject()
    scaling_parameters?: object;
}
