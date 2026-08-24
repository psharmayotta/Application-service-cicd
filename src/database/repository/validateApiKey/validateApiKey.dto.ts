import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MinLength } from "class-validator";

export class ValidateApiKeyDto {
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString({ message: 'api_key must be a string' })
    @IsNotEmpty({ message: 'api_key is required' })
    @MinLength(1, { message: 'api_key must not be empty' })
    api_key!: string;
}
