import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Length, MaxLength, ValidateIf } from 'class-validator';
import { ModelTrainingStatus, TrainingType } from '../../../config';
import { Data } from 'aws-sdk/clients/firehose';
import { DataSetDto } from '../dataSet/dataSet.dto';

export class ModelTrainingDto {
    @IsInt({ message: 'Company ID must be an integer' })
    @IsNotEmpty({ message: 'Company ID is required' })
    company_id: number;

    @IsInt({ message: 'Model ID must be an integer' })
    @IsNotEmpty({ message: 'Model ID is required' })
    model_id: number;

    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString({ message: 'Name must be a string' })
    @MaxLength(255, { message: 'Name must not exceed 255 characters' })
    @IsNotEmpty({ message: 'Name is required' })
    name: string;

    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString({ message: 'Description must be a string' })
    @IsOptional()
    description?: string;

    @IsInt({ message: 'model_category_id must be an integer' })
    @IsNotEmpty({ message: 'model_category_id is required' })
    model_category_id: number;

    @IsOptional()
    train_configuration?: any;

    @IsInt({ message: 'model_task_type must be an integer' })
    @IsNotEmpty({ message: 'model_task_type is required' })
    model_task_type_id: number;

    @IsOptional()
    dataset_configuration?: any;

    @IsOptional()
    data_set_details: DataSetDto;

    @IsOptional()
    infra_detail: any;

    @IsEnum(TrainingType, { message: 'Invalid training type' })
    @IsNotEmpty({ message: 'Training type is required' })
    training_type: TrainingType;

    @IsInt({ message: 'Accelerator ID must be an integer' })
    @IsOptional()
    accelerator_id?: number;

    @IsInt({ message: 'Accelerator count must be an integer' })
    @IsOptional()
    accelerator_count?: number;

    @IsInt({ message: 'Cloud provider ID must be an integer' })
    @IsOptional()
    cloud_provider_id?: number;

    @IsOptional()
    evaluation_details?: any;

    @IsOptional()
    deployment_details?: any;

    @IsOptional()
    training_id?: number;
}