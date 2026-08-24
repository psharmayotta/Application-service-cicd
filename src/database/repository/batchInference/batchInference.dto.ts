import { Transform } from "class-transformer";
import {
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    MaxLength,
    ValidateIf,
    Matches,
    IsIn,
    IsBoolean
} from "class-validator";
import { BatchJobStatus } from "../../../config";

export class BatchInferenceDto {
    @ValidateIf((object) => object.id !== undefined)
    @IsNumber({}, { message: "Batch job id must be a number" })
    @IsNotEmpty({ message: "Batch job id is required" })
    id!: number;

    @IsOptional()
    @IsInt({ message: "Company id must be an integer" })
    company_id?: number;

    @IsOptional()
    @IsInt({ message: "Member id must be an integer" })
    member_id?: number;

    @ValidateIf((o) => !o.id || o.name !== undefined)
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @IsString({ message: "Name must be a string" })
    @MaxLength(255, { message: "Name cannot exceed 255 characters" })
    @IsNotEmpty({ message: "Name is required" })
    name!: string;

    @IsOptional()
    @IsString({ message: "Description must be a string" })
    description?: string;

    @ValidateIf((o) => !o.id || o.cloud_provider_id !== undefined)
    @IsNotEmpty({ message: "Cloud provider id is required" })
    @IsInt({ message: "Cloud provider id must be an integer" })
    cloud_provider_id!: number;

    @IsOptional()
    @IsInt({ message: "Base model id must be an integer" })
    base_model_id?: number;

    @IsOptional()
    @IsString({ message: "Model class must be a string" })
    model_class?: string;

    @ValidateIf((o) => (!o.base_model_id && !o.id) || o.model_path !== undefined)
    @IsNotEmpty({ message: "Model path is required if base_model_id is not provided" })
    @IsString({ message: "Model path must be a string" })
    model_path?: string;

    @IsOptional()
    @IsString({ message: "Model type must be a string" })
    model_type?: string;

    @ValidateIf((o) => !o.id || o.dataset_id !== undefined)
    @IsNotEmpty({ message: "Dataset id is required" })
    @IsInt({ message: "Dataset id must be an integer" })
    dataset_id!: number;

    @IsOptional()
    @IsInt({ message: "Secret id must be an integer" })
    secret_id?: number;

    @IsOptional()
    configuration?: any;

    @IsOptional()
    @IsString({ message: "Sync frequency must be a string" })
    @IsIn(["none", "daily", "weekly", "hourly", "monthly"], { message: "Invalid sync frequency" })
    sync_frequency?: string;

    @ValidateIf((o) => o.sync_frequency === "daily" || o.sync_frequency === "weekly")
    @IsNotEmpty({ message: "Sync time is required for daily and weekly frequencies" })
    @IsString({ message: "Sync time must be a string" })
    @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: "Sync time must be in HH:mm format" })
    sync_time?: string;

    @ValidateIf((o) => o.sync_frequency === "weekly")
    @IsNotEmpty({ message: "Sync day is required for weekly frequency" })
    @IsString({ message: "Sync day must be a string" })
    @IsIn(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"], { message: "Sync day must be a valid day of the week in lowercase" })
    sync_day?: string;

    @IsOptional()
    @IsBoolean({ message: "Is sync enabled must be a boolean" })
    is_sync_enabled?: boolean;

    @IsOptional()
    @IsBoolean({ message: "Is active must be a boolean" })
    is_active?: boolean;

    @IsOptional()
    @IsEnum(BatchJobStatus, { message: "Invalid status" })
    status?: BatchJobStatus;

    @IsOptional()
    @IsNumber({}, { message: "Cloud provider must be a number" })
    cloud_provider?: number;

    @IsOptional()
    @IsString({ message: "Storage path must be a string" })
    storage_path?: string;

    @IsOptional()
    @IsInt({ message: "Cloud secret id must be an integer" })
    cloud_secret_id?: number;
}
