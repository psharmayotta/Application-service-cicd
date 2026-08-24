import { Transform } from "class-transformer";
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class GuardrailsDto {
    @IsInt({ message: "Company ID must be an integer" })
    @IsNotEmpty({ message: "Company ID is required" })
    company_id: number;

    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @IsString({ message: "Guardrail name must be a string" })
    @MaxLength(255, { message: "Guardrail name must not exceed 255 characters" })
    @IsNotEmpty({ message: "Guardrail name is required" })
    guardrail_name: string;

    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @IsString({ message: "Description must be a string" })
    @IsOptional()
    description?: string;

    @IsInt({ message: "Model category ID must be an integer" })
    @IsNotEmpty({ message: "Model category ID is required" })
    model_category_id: number;

    @IsOptional()
    configure_filters?: any;

    @IsOptional()
    @IsBoolean()
    prompt_injection?: boolean;

    @IsOptional()
    @IsBoolean()
    content_moderation?: boolean;

    @IsOptional()
    @IsBoolean()
    topic_policy?: boolean;

    @IsOptional()
    @IsBoolean()
    word_policy?: boolean;

    @IsOptional()
    @IsBoolean()
    pii_policy?: boolean;

    @IsOptional()
    @IsBoolean()
    image_content?: boolean;

    @IsString({ message: "Blocked input message must be a string" })
    @IsOptional()
    blocked_input_message?: string;

    @IsString({ message: "Blocked output message must be a string" })
    @IsOptional()
    blocked_output_message?: string;
}
