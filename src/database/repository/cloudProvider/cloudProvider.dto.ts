import { Transform } from "class-transformer";
import { IsNotEmpty, IsNumber, IsOptional, IsString, Length, ValidateIf } from "class-validator";

export class CloudProviderDto {
    @ValidateIf((object, value) => object.id !== undefined)
    @IsNumber()
    @IsNotEmpty({ message: 'Cloud Provider id is required' })
    id!: number;

    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString({ message: 'Cloud Name must be a string' })
    @IsNotEmpty({ message: 'Cloud Name is required' })
    @Length(3, 255, { message: 'Cloud Name must be between 3 and 255 characters' })
    name!: string;

    @IsOptional()
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString({ message: 'Cloud Code must be a string' })
    @Length(3, 255, { message: 'Cloud Code must be between 3 and 255 characters' })
    cloud_code?: string;
}