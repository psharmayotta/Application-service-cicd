import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class DeploymentMetricsDto {
    @IsNotEmpty({ message: 'Deployment ID is required' })
    deployment_id!: string | number;

    @IsOptional()
    @IsNumber()
    hours?: number;

    @IsOptional()
    @IsString()
    start?: string;

    @IsOptional()
    @IsString()
    end?: string;

    @IsOptional()
    @IsString()
    startDate?: string;

    @IsOptional()
    @IsString()
    endDate?: string;

    @IsOptional()
    @IsBoolean()
    latest?: boolean;

    @IsOptional()
    @IsNumber()
    limit?: number;
}
