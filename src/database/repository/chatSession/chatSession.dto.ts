import { Transform } from "class-transformer";
import { IsString, ValidateIf, IsNotEmpty, IsNumber } from "class-validator";

export class ChatSessionDto {
    @ValidateIf((object, value) => object.id !== undefined)
    @IsNumber()
    @IsNotEmpty({ 'message': 'Model id is required' })
    id!: number;

    @IsNumber()
    @IsNotEmpty({ 'message': 'Company id is required' })
    company_id!: number;

    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString()
    @IsNotEmpty({ 'message': "API Key is required" })
    api_key!: string;

    @IsNumber()
    @IsNotEmpty({ 'message': 'Model Id is required' })
    model_id!: number;
} 
