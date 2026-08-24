import { Transform } from "class-transformer";
import { IsNotEmpty, IsNumber, IsOptional, IsString, Length, ValidateIf } from "class-validator";

export class CloudZoneDto {
    @ValidateIf((object, value) => object.id !== undefined)
    @IsNumber()
    @IsNotEmpty({ message: 'Cloud Zone id is required' })
    id!: number;

    @IsNumber()
    @IsNotEmpty({ message: 'Cloud Provider id is required' })
    c_provider_id!: number;

    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString({ message: 'Cloud Zone Name must be a string' })
    @IsNotEmpty({ message: 'Cloud Zone Name is required' })
    @Length(3, 300, { message: 'Cloud Zone Name must be between 3 and 255 characters' })
    name!: string;

    @IsOptional()
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString({ message: 'Cloud Zone Code must be a string' })
    @Length(3, 300, { message: 'Cloud Zone Code must be between 3 and 255 characters' })
    cloud_zone_code?: string;
}