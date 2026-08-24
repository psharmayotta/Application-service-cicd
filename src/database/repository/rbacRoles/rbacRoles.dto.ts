import { IsString, IsOptional, IsNumber, MaxLength } from "class-validator";

export class RbacRolesDto {
    @IsString()
    @MaxLength(255)
    role_name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsNumber()
    status?: number;
}
