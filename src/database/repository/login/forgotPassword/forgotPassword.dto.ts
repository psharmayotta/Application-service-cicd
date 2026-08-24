import { IsString, IsEmail, IsOptional } from 'class-validator';

export class ForgotPasswordDto {
    @IsEmail()
    email: string;

    @IsOptional()
    @IsString()
    otp?: string;

    @IsOptional()
    @IsString()
    newPassword?: string;
}
