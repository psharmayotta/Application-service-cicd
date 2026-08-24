import { Transform } from "class-transformer";
import { IsNotEmpty, IsNumber, IsString, Length, ValidateIf } from "class-validator";

export class ModelTaskDto {
    @ValidateIf((object, value) => object.id !== undefined)
    @IsNumber()
    @IsNotEmpty({ 'message': 'Model Task id is required' })
    id!: number;

    @IsNumber()
    @IsNotEmpty({ 'message': 'Model Category id is required' })
    model_category_id!: number;

    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString()
    @IsNotEmpty({ 'message': 'Model Task Name is required' })
    @Length(3, 255, { 'message': 'Model Task Name must be between 3 and 255 characters' })
    name!: string;

}