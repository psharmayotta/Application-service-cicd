import { IsString, IsOptional, IsBoolean, MaxLength } from "class-validator";

export class RolesDto {
    @IsString()
    @MaxLength(50)
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    active?: boolean;
} 