import { IsNumber, IsOptional, IsString } from "class-validator";

export class HardwareMasterModel {
    @IsOptional()
    @IsNumber()
    id: number;

    @IsOptional()
    @IsString()
    component_type: string;

    @IsOptional()
    @IsString()
    model_name: string;

    @IsOptional()
    @IsString()
    manufacturer: string;

    @IsOptional()
    @IsNumber()
    core_count: number;

    @IsOptional()
    @IsNumber()
    thread_count: number;

    @IsOptional()
    @IsNumber()
    clock_speed_ghz: number;

    @IsOptional()
    @IsNumber()
    vram_size_gb: number;

    @IsOptional()
    @IsString()
    vram_type: string;

    @IsOptional()
    @IsNumber()
    storage_capacity_gb: number;

    @IsOptional()
    @IsString()
    storage_type: string;
}
