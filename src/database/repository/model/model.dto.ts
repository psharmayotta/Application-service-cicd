import { Transform } from "class-transformer";
import { ValidateIf, IsNumber, IsNotEmpty, IsString, Length, Matches, ArrayNotEmpty, Validate, IsOptional, IsArray, IsObject, IsDateString } from "class-validator";
import { FileExistsValidator } from "../../../core/FileExistValidatorfn";

export class ModelDto {
    @ValidateIf((object, value) => object.id !== undefined)
    // @IsNumber()
    @IsNotEmpty({ 'message': 'Model id is required' })
    id!: number;

    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString()
    @IsNotEmpty({ 'message': "Name is required" })
    @Length(2, 100, { message: 'Name must be between 2 and 100 characters' })
    name!: string;

    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString()
    @IsNotEmpty({ 'message': "version is required" })
    @Length(1, 50, { message: 'version must be between 1 and 50 characters' })
    version!: string;

    // @IsNumber()
    @IsNotEmpty({ 'message': 'Model Libararies is required' })
    model_libararies_id!: number;

    // @IsNumber()
    @IsNotEmpty({ 'message': 'Model Category is required' })
    model_category_id!: number;

    // @IsNumber()
    // @IsNotEmpty({ 'message': 'Model GPU is required' })
    // model_gpu_id!: number;

    // @IsNumber()
    @IsNotEmpty({ 'message': 'Model Task is required' })
    model_task_id!: number;

    // @IsNumber()
    @IsNotEmpty({ 'message': 'Model Licenses is required' })
    model_licenses_id!: number;

    // @IsNumber()
    @IsNotEmpty({ 'message': 'Model Provider is required' })
    model_provider_id!: number;

    // @IsNumber()
    @IsNotEmpty({ 'message': 'Model Source is required' })
    model_source_id!: number;

    // @IsNumber()
    // @IsNotEmpty({ 'message': 'Model Rank is required' })
    // model_rank!: number;

    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString()
    @IsNotEmpty({ 'message': "Model Source is required" })
    @Length(2, 100, { message: 'Model Source must be between 2 and 100 characters' })
    model_source_repo!: string;

    @ValidateIf((object) => {
        return (
            !object.id ||
            (object.id && Array.isArray(object.files) && object.files.some(f => f.fieldname === 'model_image'))
        );
    })
    @ArrayNotEmpty()
    @Validate(FileExistsValidator, {
        message: 'Enter a file or file not valid',
    })
    files!: [];


    @IsOptional()
    @ValidateIf((_, value) => value !== null)
    @IsObject({ message: 'supported_features must be a JSON object' })
    supported_features?: Record<string, any>;

    @IsOptional()
    @ValidateIf((_, value) => value !== null)
    @IsArray({ message: 'input_data_format_support must be an array' })
    input_data_format_support?: any[];

    @IsOptional()
    @ValidateIf((_, value) => value !== null)
    @IsArray({ message: 'output_data_format_support must be an array' })
    output_data_format_support?: any[];

    @IsOptional()
    @ValidateIf((_, value) => value !== null)
    @IsArray({ message: 'supported_languages must be an array' })
    supported_languages?: any[];

    @IsOptional()
    @ValidateIf((_, value) => value !== null)
    @IsObject({ message: 'model_developer_and_architecture must be a JSON object' })
    model_developer_and_architecture?: Record<string, any>;

    @IsOptional()
    @IsDateString({}, { message: 'new_models_due_date must be a valid ISO date string' })
    new_models_due_date?: string;
}