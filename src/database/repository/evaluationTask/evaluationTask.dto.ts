import { IsInt, IsNotEmpty, IsOptional, IsString, IsObject, IsBoolean, MaxLength } from "class-validator";

export class EvaluationTaskDto {
    @IsOptional()
    @IsInt({ message: "ID must be an integer" })
    id?: number;

    @IsString({ message: "Name must be a string" })
    @MaxLength(255, { message: "Name cannot exceed 255 characters" })
    @IsNotEmpty({ message: "Name is required" })
    name!: string;

    @IsOptional()
    @IsString({ message: "Description must be a string" })
    description?: string;

    @IsString({ message: "Task type must be a string" })
    @IsNotEmpty({ message: "Task type is required" })
    task_type!: string;

    @IsOptional()
    @IsString({ message: "Category must be a string" })
    category?: string;

    @IsOptional()
    @IsInt({ message: "Category ID must be an integer" })
    category_id?: number;

    @IsOptional()
    @IsObject({ message: "Required metrics must be a valid JSON object" })
    required_metrics?: any;

    @IsOptional()
    @IsObject({ message: "Sample input must be a valid JSON object" })
    sample_input?: any;

    @IsOptional()
    @IsString({ message: "Expected output format must be a string" })
    expected_output_format?: string;

    @IsOptional()
    @IsString({ message: "Difficulty level must be a string" })
    difficulty_level?: string;

    @IsOptional()
    @IsInt({ message: "Estimated tokens must be an integer" })
    estimated_tokens?: number;

    @IsOptional()
    @IsBoolean({ message: "is_active must be a boolean" })
    is_active?: boolean;

    @IsOptional()
    @IsString({ message: "Icon must be a string" })
    icon?: string;
}
