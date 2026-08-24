import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt, MaxLength, Min } from 'class-validator';

export class EmbeddingModelDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    @MaxLength(255)
    model_code?: string;

    @IsInt()
    @Min(1)
    @IsOptional()
    default_vector_dimensions?: number;

    @IsString()
    @IsOptional()
    icon?: string;

    @IsBoolean()
    @IsOptional()
    status?: boolean;

    @IsInt()
    @IsOptional()
    model_max?: number;

    @IsInt()
    @IsOptional()
    safe_max?: number;

    @IsString()
    @IsOptional()
    @MaxLength(255)
    recommended_chunk?: string;

    @IsInt()
    @IsOptional()
    max_overlap?: number;
}
