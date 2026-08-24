import { Transform } from "class-transformer";
import { IsNotEmpty, IsNumber, IsString, Length, ValidateIf } from "class-validator";

export class ModelClassDto {
    @ValidateIf((object, value) => object.id !== undefined)
    @IsNumber()
    @IsNotEmpty({ 'message': 'Roles id is required' })
    id!: number;

    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString()
    @IsNotEmpty({ 'message': 'Name is required' })
    @Length(3, 255, { 'message': 'Name must be between 3 and 255 characters' })
    name!: string;

}