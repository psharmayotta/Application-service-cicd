import { IsString, IsOptional, IsNumber } from 'class-validator';
import { InferModel } from '../InferModel/InferModel.model';

export class BenchmarkingDatasetDto extends InferModel {
    @IsString()
    dataset_name: string;

    @IsString()
    @IsOptional()
    purpose?: string;

    @IsString()
    @IsOptional()
    size?: string;

    @IsNumber()
    @IsOptional()
    category_id?: number;

    @IsNumber()
    @IsOptional()
    evaluation_task_id?: number;
}
