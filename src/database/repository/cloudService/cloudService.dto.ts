import { Transform } from "class-transformer";
import { IsNotEmpty, IsNumber, IsOptional, IsString, Length, ValidateIf } from "class-validator";

export class CloudServiceDto {
    @ValidateIf((object, value) => object.id !== undefined)
    @IsNumber()
    @IsNotEmpty({ message: 'Cloud Service id is required' })
    id!: number;

    @IsNumber()
    @IsNotEmpty({ message: 'Cloud Provider id is required' })
    c_provider_id!: number;

    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString({ message: 'Cloud Service Name must be a string' })
    @IsNotEmpty({ message: 'Cloud Service Name is required' })
    @Length(3, 300, { message: 'Cloud Service Name must be between 3 and 255 characters' })
    name!: string;
}