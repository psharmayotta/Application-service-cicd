import { Transform } from "class-transformer";
import { IsNotEmpty, IsNumber, IsOptional, IsString, Length, ValidateIf } from "class-validator";

export class ApiKeyTokenDto {
    @ValidateIf((object, value) => object.id !== undefined)
    @IsNumber()
    @IsNotEmpty({ message: 'Api Key Token id is required' })
    id: number;

    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @ValidateIf((o) => o.api_key_name !== null && o.api_key_name !== undefined && o.api_key_name !== '')
    @IsString({ message: 'Api Key name must be a string' })
    @Length(3, 300, { message: 'Api Key name must be between 3 and 300 characters' })
    api_key_name?: string;

    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString()
    @IsNotEmpty({ message: 'Created Token Time is required' })
    generated_token_time!: string;

    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString()
    @IsNotEmpty({ message: 'Expiry Token Time is required' })
    expiry_token_time!: string;
}
