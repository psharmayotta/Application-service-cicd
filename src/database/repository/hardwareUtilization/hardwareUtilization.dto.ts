import { Transform, Type } from "class-transformer";
import { IsString, ValidateIf, IsNotEmpty, IsNumber, IsOptional, IsDate, IsObject } from "class-validator";

export class HardwareUtilizationDto {
    @ValidateIf((o, v) => o.id !== undefined)
    @IsNumber()
    @IsNotEmpty({ message: 'Hardware utilization id is required' })
    id!: number;

    @IsOptional()
    @IsNumber()
    pod_id?: number;

    @IsOptional()
    @IsNumber()
    infra_allocation_id?: number;

    @IsOptional()
    @IsNumber()
    node_id?: number;

    @IsOptional()
    @IsString()
    container_name?: string;

    @IsOptional()
    @Type(() => Date)
    @IsDate()
    timestamp?: Date;

    @IsOptional()
    @IsNumber()
    cpu_usage_cores?: number;

    @IsOptional()
    @IsNumber()
    cpu_usage_percent?: number;

    @IsOptional()
    @IsNumber()
    memory_usage_mb?: number;

    @IsOptional()
    @IsNumber()
    memory_percent?: number;

    @IsOptional()
    @IsNumber()
    gpu_usage_percent?: number;

    @IsOptional()
    @IsNumber()
    gpu_memory_used_mb?: number;

    @IsOptional()
    @IsNumber()
    network_rx_bytes?: number;

    @IsOptional()
    @IsNumber()
    network_tx_bytes?: number;

    @IsOptional()
    @IsNumber()
    disk_read_bytes?: number;

    @IsOptional()
    @IsNumber()
    disk_write_bytes?: number;

    @IsOptional()
    @IsObject()
    metrics_metadata?: object;
}
