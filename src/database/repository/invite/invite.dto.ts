import { IsString, IsEmail, IsArray, ArrayNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class InviteDto {
    @IsString()
    @IsOptional()
    company_unique_code: string;

    @IsArray()
    @ArrayNotEmpty()
    @IsEmail({}, { each: true })
    email: string[];

    @IsNumber()
    @IsOptional()
    role_id: number;
}
