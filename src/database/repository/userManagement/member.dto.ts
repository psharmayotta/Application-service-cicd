import { IsString, IsNumber, IsOptional, IsBoolean, IsEmail, MaxLength, Matches } from "class-validator";

export class MemberDto {
    @IsOptional()
    @IsNumber()
    company_id?: number;

    @IsOptional()
    @IsEmail()
    @MaxLength(255)
    email?: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    full_name?: string;

    @IsOptional()
    @IsNumber()
    role_id?: number;

    @IsOptional()
    @IsString()
    profile_picture?: string;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;

    @IsOptional()
    @IsString()
    @Matches(/^[0-9]+$/, {
        message: 'mobile_no must contain digits only and should be of length 10'
    })
    mobile_no?: string;
}
