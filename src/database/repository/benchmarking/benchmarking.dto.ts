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
    IsArray,
} from "class-validator";
import { BenchmarkingType } from "../../../config";

const isHardwareBenchmarking = (value: unknown): boolean =>
    value === BenchmarkingType.HARDWARE;

const isModelBenchmarking = (value: unknown): boolean =>
    value === BenchmarkingType.MODEL;

const isModelBenchmarkingOrEvaluation = (value: unknown): boolean =>
    value === BenchmarkingType.MODEL || value === BenchmarkingType.MODEL_EVALUATION;

const isHardwareBenchmarkingOrEvaluation = (value: unknown): boolean =>
    value === BenchmarkingType.HARDWARE || value === BenchmarkingType.MODEL_EVALUATION;

const isModelEvaluation = (value: unknown): boolean =>
    value === BenchmarkingType.MODEL_EVALUATION;

export class BenchmarkingDto {
    @ValidateIf((object) => object.id !== undefined)
    @IsNumber({}, { message: "Benchmarking id must be a number" })
    @IsNotEmpty({ message: "Benchmarking id is required" })
    id!: number;

    @IsOptional()
    @IsInt({ message: "Company id must be an integer" })
    company_id?: number;

    @IsOptional()
    @IsInt({ message: "Member id must be an integer" })
    member_id?: number;

    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @IsString({ message: "Name must be a string" })
    @MaxLength(255, { message: "Name cannot exceed 255 characters" })
    @IsNotEmpty({ message: "Name is required" })
    name!: string;

    @IsString({ message: "Description must be a string" })
    @IsOptional()
    description!: string;

    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @IsEnum(BenchmarkingType, { message: "Invalid benchmarking type. Must be one of: Hardware Benchmarking, Model Benchmarking, RAG Benchmarking, Model Evaluation" })
    @IsNotEmpty({ message: "Benchmarking type is required" })
    benchmarking_type!: BenchmarkingType;

    @IsOptional()
    @ValidateIf((object) => isModelBenchmarkingOrEvaluation(object.benchmarking_type))
    @IsInt({ message: "Model category id must be an integer" })
    @IsNotEmpty({ message: "Model category id is required" })
    model_category_id!: number;

    @IsOptional()
    @ValidateIf((object) => isModelBenchmarkingOrEvaluation(object.benchmarking_type))
    @IsInt({ message: "Model 1 source id must be an integer" })
    @IsNotEmpty({ message: "Model 1 source id is required" })
    model_source_id!: number;

    @IsOptional()
    @ValidateIf((object) => isModelBenchmarkingOrEvaluation(object.benchmarking_type))
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @IsString({ message: "Model path must be a string" })
    @IsNotEmpty({ message: "Model path is required" })
    model_path!: string;

    @IsOptional()
    @IsInt({ message: "Cloud secret id 1 must be an integer" })
    cloud_secret_id_1!: number;

    @IsOptional()
    @IsInt({ message: "Cloud secret id 2 must be an integer" })
    cloud_secret_id_2!: number;

    @IsOptional()
    @ValidateIf((object) => isModelBenchmarkingOrEvaluation(object.benchmarking_type))
    @IsInt({ message: "Model class id must be an integer" })
    @IsNotEmpty({ message: "Model class id is required" })
    model_class_id!: number;

    @IsOptional()
    @IsString({ message: "Model type must be a string" })
    model_type!: string;

    @IsOptional()
    @IsString({ message: "Model 2 type must be a string" })
    model_2_type!: string;


    @IsOptional()
    @ValidateIf((object) => isModelBenchmarking(object.benchmarking_type))
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @IsString({ message: "Model 2 path must be a string" })
    model_2_path!: string;

    @IsOptional()
    @ValidateIf((object) => isModelBenchmarkingOrEvaluation(object.benchmarking_type))
    @IsInt({ message: "Base model id must be an integer" })
    @IsNotEmpty({ message: "Base model is required" })
    base_model!: number;

    @IsOptional()
    @IsInt({ message: "Base model 2 id must be an integer" })
    base_model_2!: number;

    @IsOptional()
    @ValidateIf((object) => isModelBenchmarking(object.benchmarking_type))
    @IsInt({ message: "Model 2 source id must be an integer" })
    @IsNotEmpty({ message: "Model 2 source id is required" })
    model_2_source_id!: number;

    @IsOptional()
    @ValidateIf((object) => isHardwareBenchmarkingOrEvaluation(object.benchmarking_type))
    @IsInt({ message: "Hardware 1 GPU type must be an integer" })
    @IsNotEmpty({ message: "Hardware 1 GPU type is required" })
    hardware_1_gpu_type!: number;

    @IsOptional()
    @ValidateIf((object) => isHardwareBenchmarkingOrEvaluation(object.benchmarking_type))
    @IsInt({ message: "Hardware 1 GPU count per node must be an integer" })
    @IsNotEmpty({ message: "Hardware 1 GPU count per node is required" })
    hardware_1_gpu_count_per_node!: number;

    @IsOptional()
    @ValidateIf((object) => isHardwareBenchmarking(object.benchmarking_type))
    @IsInt({ message: "Hardware 2 GPU type must be an integer" })
    @IsNotEmpty({ message: "Hardware 2 GPU type is required" })
    hardware_2_gpu_type!: number;

    @IsOptional()
    @ValidateIf((object) => isHardwareBenchmarking(object.benchmarking_type))
    @IsInt({ message: "Hardware 2 GPU count per node must be an integer" })
    @IsNotEmpty({ message: "Hardware 2 GPU count per node is required" })
    hardware_2_gpu_count_per_node!: number;

    @IsOptional()
    inference_setting!: any;

    @IsOptional()
    inference_setting2!: any;

    @IsOptional()
    @IsString({ message: "Base model 1 category must be a string" })
    base_model_1_category!: string;

    @IsOptional()
    @IsString({ message: "Base model 2 category must be a string" })
    base_model_2_category!: string;

    @IsOptional()
    @IsInt({ message: "AI model id must be an integer" })
    ai_model!: number;

    @IsOptional()
    @IsString({ message: "Prompt must be a string" })
    prompt!: string;

    @IsOptional()
    dataset_id!: any;

    @IsOptional()
    @IsArray({ message: "Concurrent users must be an array" })
    @IsInt({ each: true, message: "Each concurrent user must be an integer" })
    concurrent_users?: number[];

    @IsOptional()
    @IsString({ message: "Status must be a string" })
    status?: string;

    @IsOptional()
    results_1?: any;

    @IsOptional()
    results_2?: any;

    @IsOptional()
    @ValidateIf((object) => isModelEvaluation(object.benchmarking_type))
    @IsInt({ message: "Evaluation task ID must be an integer" })
    @IsNotEmpty({ message: "Evaluation task ID is required" })
    evaluation_task_id?: number;

    @IsOptional()
    @IsInt({ message: "Knowledgebase id must be an integer" })
    knowledgebase_id?: number;
}
