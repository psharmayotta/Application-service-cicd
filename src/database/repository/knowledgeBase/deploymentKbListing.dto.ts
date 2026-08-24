import { IsOptional, IsString, IsNumber } from 'class-validator';

export class DeploymentKbListingDto {
    @IsOptional()
    @IsNumber()
    pageNumber?: number;

    @IsOptional()
    @IsNumber()
    pageSize?: number;

    @IsOptional()
    @IsString()
    search_text?: string;
}
