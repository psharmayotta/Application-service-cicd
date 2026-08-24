import { IsBoolean, IsDate, IsNotEmpty, IsNumber, IsOptional, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class CloudSecretsDto {
    @IsOptional()
    @IsNumber()
    id?: number;

    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString()
    @IsNotEmpty({ message: 'Name is required' })
    @Length(3, 300, { message: 'Name must be between 3 and 300 characters' })
    name!: string;

    @IsNumber()
    @IsNotEmpty({ message: 'Cloud Provider is requried' })
    c_provider_id!: number;

    @IsOptional()
    @IsNumber()
    cloud_services_id?: number;

    @IsNotEmpty({ message: 'Secrets are required' })
    secrets: any;

    @IsNumber()
    @IsNotEmpty({ message: 'Company ID is required' })
    company_id: number;

    //   @IsOptional()
    //   @IsString()
    //   @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    //   member_id?: number;

    @IsOptional()
    @IsBoolean()
    status?: boolean;

    @IsOptional()
    last_used_at?: Date;

    @IsOptional()
    @IsString()
    last_used_by_module?: string;
}
