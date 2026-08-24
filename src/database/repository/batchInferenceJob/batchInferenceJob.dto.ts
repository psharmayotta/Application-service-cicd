import { Transform } from "class-transformer";
import {
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
} from "class-validator";
import { BatchJobStatus } from "../../../config";

export class BatchInferenceJobDto {
    @IsOptional()
    @IsNumber({}, { message: "Batch job id must be a number" })
    id?: number;

    @IsNotEmpty({ message: "Inference ID is required" })
    @IsInt({ message: "Inference ID must be an integer" })
    inference_id!: number;

    @IsOptional()
    @IsEnum(BatchJobStatus, { message: "Invalid job status" })
    status?: BatchJobStatus;

    @IsOptional()
    result?: any;

    @IsOptional()
    configuration?: any;

    @IsOptional()
    @IsString()
    report_path?: string;

    @IsOptional()
    progress?: any;

    @IsOptional()
    @IsString()
    logs?: string;
}
