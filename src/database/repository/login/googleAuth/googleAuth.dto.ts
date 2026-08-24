import { IsString, IsOptional, IsEmail } from 'class-validator';

export class GoogleAuthDto {
    @IsString()
    token: string;

    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsString()
    name?: string;
}
