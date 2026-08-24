import { Transform } from "class-transformer";
import { IsNotEmpty, IsNumber, IsOptional, IsString, Length, ValidateIf } from "class-validator";

export class ContactUsDto {
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsNotEmpty({ message: 'Model Name is required' })
    model_name: string | string[];

    @IsNotEmpty({ message: 'Email is required' })
    @IsString({ message: 'email Code must be a string' })
    email: string;
}