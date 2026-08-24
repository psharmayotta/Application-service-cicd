import { IsString, IsOptional, IsBoolean, IsEmail, MaxLength } from "class-validator";

export class CompanyDto {
    @IsString()
    @MaxLength(255)
    company_name: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    industry?: string;

    @IsOptional()
    @IsEmail()
    @MaxLength(255)
    company_email?: string;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;
}