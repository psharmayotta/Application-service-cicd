import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class LokiLogDto {
    @IsNotEmpty()
    @IsString()
    model_id: string;

    @IsNotEmpty()
    @IsString()
    model_org: string;

    @IsOptional()
    @IsNumber()
    hours_back: number;

    @IsOptional()
    @IsNumber()
    limit: number;

    @IsOptional()
    @IsString()
    module: string;

    @IsOptional()
    @IsString()
    start_time: string;

    @IsOptional()
    @IsString()
    end_time: string;

    @IsOptional()
    @IsString()
    log_level?: string;
}
