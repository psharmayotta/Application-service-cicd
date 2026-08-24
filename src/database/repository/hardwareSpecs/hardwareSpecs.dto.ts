import { Transform } from "class-transformer";
import { IsIn, IsNotEmpty, IsNumber, IsString, Length, Matches, ValidateIf } from "class-validator";

export class HardwareSpecsDto {

    //--------- common validation -----------
    @ValidateIf((object) => object.id !== undefined)
    @IsNumber()
    @IsNotEmpty({ message: 'Hardware specs id is required' })
    id: number;

    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString({ message: "Component Type must be of string type" })
    @IsNotEmpty({ message: "Component Type is required" })
    @IsIn(['CPU', 'GPU', 'STORAGE'], { message: 'Component Type must be one of (CPU, GPU, STORAGE)' })
    component_type: string;

    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString({ message: "Model Name must be of string type" })
    @IsNotEmpty({ message: "Model Name is required" })
    @Length(2, 250, { message: 'Model Name must be between 2 and 250 characters' })
    model_name: string;

    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString({ message: "Manufacturer must be of string type" })
    @IsNotEmpty({ message: "Manufacturer is required" })
    @Length(2, 250, { message: 'Manufacturer must be between 2 and 250 characters' })
    manufacturer: string;

    @IsNumber()
    @IsNotEmpty({ message: 'Hardware specs id is required' })
    region_id: number;

    @IsNumber()
    @IsNotEmpty({ message: 'Hardware specs id is required' })
    zone_id: number;

    @IsNumber()
    @IsNotEmpty({ message: 'Hardware specs id is required' })
    cloud_provider_id: number;

    // ---------------- CPU and GPU specific ----------------
    @ValidateIf((o) => o.component_type === 'CPU' || o.component_type === 'GPU')
    @IsNumber({}, { message: "Core count must be a number" })
    @IsNotEmpty({ message: "Core count is required for CPU" })
    core_count: number;

    @ValidateIf((o) => o.component_type === 'CPU' || o.component_type === 'GPU')
    @IsNumber({}, { message: "Thread count must be a number" })
    @IsNotEmpty({ message: "Thread count is required for CPU" })
    thread_count: number;

    @ValidateIf((o) => o.component_type === 'CPU' || o.component_type === 'GPU')
    @IsNumber({}, { message: "Clock speed must be a number" })
    @IsNotEmpty({ message: "Clock speed is required for CPU" })
    clock_speed_ghz: number;

    // ---------------- GPU specific ----------------
    @ValidateIf((o) => o.component_type === 'GPU')
    @IsNumber({}, { message: "VRAM size must be a number" })
    @IsNotEmpty({ message: "VRAM size is required for GPU" })
    vram_size_gb: number;

    @ValidateIf((o) => o.component_type === 'GPU')
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString({ message: "VRAM type must be a string" })
    @IsNotEmpty({ message: "VRAM type is required for GPU" })
    vram_type: string;

    @ValidateIf((o) => o.component_type === 'GPU')
    @IsNumber({}, { message: "TDP must be a number" })
    @IsNotEmpty({ message: "TDP is required for GPU" })
    tdp_watt: number;

    // ---------------- Storage specific ----------------
    @ValidateIf((o) => o.component_type === 'STORAGE')
    @IsNumber({}, { message: "Storage capacity must be a number" })
    @IsNotEmpty({ message: "Storage capacity is required for Storage" })
    storage_capacity_gb: number;

    @ValidateIf((o) => o.component_type === 'STORAGE')
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsIn(['HDD', 'SSD', 'NVME'], { message: "Storage type must be one of (HDD, SSD, NVME)" })
    @IsNotEmpty({ message: "Storage type is required for Storage" })
    storage_type: string;

    @ValidateIf((o) => o.component_type === 'STORAGE')
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString({ message: "Interface must be a string" })
    @IsNotEmpty({ message: "Interface is required for Storage" })
    interface: string;
}