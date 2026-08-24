import { IsNumber, IsOptional, IsString } from 'class-validator';

export class AuditLogDto {
    @IsNumber()
    @IsOptional()
    company_id: number;

    @IsString()
    @IsOptional()
    module: string;

    @IsString()
    @IsOptional()
    action: string;

    @IsNumber()
    @IsOptional()
    member_id: number;

    @IsString()
    @IsOptional()
    search: string;
}
