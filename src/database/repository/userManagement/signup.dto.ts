import { IsString, IsEmail, MaxLength, MinLength, IsOptional, IsPhoneNumber } from "class-validator";

export class SignupDto {
    @IsEmail()
    @MaxLength(255)
    email: string;

    @IsString()
    @MinLength(6)
    @MaxLength(255)
    password: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    full_name?: string;

    @IsOptional()
    @IsString()
    @MaxLength(20)
    phone?: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    address?: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    company_name?: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    role_name?: string;
}

export class EmailVerificationDto {
    @IsString()
    token: string;
}
