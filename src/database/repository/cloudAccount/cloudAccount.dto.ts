import { Transform } from "class-transformer";
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Length } from "class-validator";

export class CloudAccountDto {
    @IsOptional()
    @IsNumber()
    id?: number

    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString()
    @IsNotEmpty({ message: 'Cloud Account Name is required' })
    @Length(3, 300, { message: 'Cloud Account Name must be between 3 and 255 characters' })
    account_name!: string;

    @IsNumber()
    @IsNotEmpty({ message: 'Cloud Provider is requried' })
    cloud_provider_id!: number;

    @IsNumber()
    @IsNotEmpty({ message: 'Cloud Region is required.' })
    cloud_region_id!: number;

    @IsNumber()
    @IsNotEmpty({ message: 'Cloud Secret is required.' })
    cloud_secret_id!: number;

    @IsNumber()
    @IsNotEmpty({ message: 'Company ID is required' })
    company_id: number;

    @IsOptional()
    @IsBoolean()
    status?: boolean;
}