import { IsOptional, IsString, IsBoolean, IsObject, ValidateNested } from 'class-validator';

export class YottaOneIntegrationDto {
    @IsOptional()
    @IsObject()
    user?: any;

    @IsOptional()
    @IsString()
    username?: string;

    @IsOptional()
    @IsString()
    password?: string;

    @IsOptional()
    @IsString()
    organizationName?: string;

    @IsOptional()
    @IsString()
    organization_name?: string;

    @IsOptional()
    @IsString()
    external_customer_id?: string;

    @IsOptional()
    @IsBoolean()
    isKYC?: boolean;

    @IsOptional()
    @IsBoolean()
    is_kyc?: boolean;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsObject()
    billing_address?: any;

    @IsOptional()
    @IsObject()
    metadata?: any;
}
