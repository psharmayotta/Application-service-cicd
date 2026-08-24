import { Transform, Type } from "class-transformer";
import { IsString, ValidateIf, IsNotEmpty, IsNumber, IsOptional, IsDate, IsObject, IsArray, ValidateNested, Min,} from "class-validator";

export class PodDetailsDto {
  @ValidateIf((o, v) => o.id !== undefined)
  @IsNumber()
  @IsNotEmpty({ message: "Pod id is required" })
  id!: number;

  @IsOptional()
  @IsNumber()
  infra_allocation_id?: number;

  @IsOptional()
  @IsString()
  pod_name?: string;

  @IsOptional()
  @IsString()
  namespace?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  node_id?: number;

  @IsOptional()
  @IsString()
  host_ip?: string;

  @IsOptional()
  @IsString()
  pod_ip?: string;

  @IsOptional()
  @IsNumber()
  restart_count?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  start_time?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  end_time?: Date;

  @IsOptional()
  @IsNumber()
  cpu_request?: number;

  @IsOptional()
  @IsNumber()
  cpu_limit?: number;

  @IsOptional()
  @IsNumber()
  memory_request_mb?: number;

  @IsOptional()
  @IsNumber()
  memory_limit_mb?: number;

  @IsOptional()
  @IsNumber()
  gpu_request?: number;

  @IsOptional()
  @IsNumber()
  gpu_memory_mb?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VolumeMount)
  volume_mounts?: VolumeMount[];

  @IsOptional()
  @IsObject()
  labels?: Record<string, string>;

  @IsOptional()
  @IsObject()
  annotations?: Record<string, string>;

  @IsOptional()
  @IsString()
  logs_path?: string;
}

export class VolumeMount {
  @IsString()
  @IsNotEmpty({ message: "Volume mount path is required" })
  path!: string;

  @IsNumber()
  @Min(1, { message: "size_gb must be greater than 0" })
  size_gb!: number;

  @IsString()
  @IsNotEmpty({ message: "Volume type is required" })
  type!: string;
}
