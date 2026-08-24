import { Transform } from "class-transformer";
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Length } from "class-validator";

export class HostedZoneDto {
    @IsOptional()
    @IsNumber()
    id?: number;

    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString()
    @IsNotEmpty({ message: 'Hosted Zone Name is required' })
    @Length(3, 300, { message: 'Hosted zone name must be between 3 and 300 characters' })
    hosted_zone_name!: string;

    @IsNumber()
    @IsNotEmpty({ message: 'Company ID is required' })
    company_id!: number;

    @IsNumber()
    @IsNotEmpty({ message: 'Cloud Account ID is required' })
    cloud_account_id!: number;

    @IsString()
    @IsNotEmpty({ message: 'Sub-domain is required' })
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    sub_domain!: string;

    @IsString()
    @IsNotEmpty({ message: 'Domain is required' })
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    domain!: string;

    @IsString()
    @IsNotEmpty({ message: 'Zone ID is required' })
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    zone_id!: string;

    @IsOptional()
    @IsBoolean()
    status?: boolean;
}
