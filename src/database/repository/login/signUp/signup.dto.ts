import { IsEmail, IsString, IsOptional } from 'class-validator';

export class SignupDto {
    @IsEmail()
    email: string;

    @IsString()
    password: string;

    @IsOptional()
    @IsString()
    name?: string;
}
