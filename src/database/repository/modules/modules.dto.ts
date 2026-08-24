import { IsString, IsOptional, MaxLength } from "class-validator";

export class ModulesDto {
    @IsString()
    @MaxLength(100)
    name: string;

    @IsOptional()
    @IsString()
    description?: string;
} 