import { IsNotEmpty, IsNumber, ValidateIf } from "class-validator";

export class ModelCategoryDto {
    @ValidateIf((object, value) => object.id !== undefined)
    @IsNumber()
    @IsNotEmpty({ 'message': 'Roles id is required' })
    id!: number;
}