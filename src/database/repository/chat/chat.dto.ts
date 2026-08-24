import { Transform } from "class-transformer";
import { IsString, ValidateIf, IsNotEmpty, IsNumber } from "class-validator";

export class ChatDto {
    @ValidateIf((object, value) => object.id !== undefined)
    @IsNumber()
    @IsNotEmpty({ 'message': 'Model id is required' })
    id!: number;
} 
