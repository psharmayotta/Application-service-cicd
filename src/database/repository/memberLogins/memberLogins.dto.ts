import { IsNumber, IsString, IsOptional, MaxLength } from "class-validator";

export class MemberLoginsDto {
    @IsNumber()
    member_id: number;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    provider?: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    provider_user_id?: string;

    @IsOptional()
    @IsString()
    access_token?: string;

    @IsOptional()
    @IsString()
    refresh_token?: string;

    @IsOptional()
    @IsString()
    password?: string;
} 