import { IsNumber, IsBoolean, IsOptional } from "class-validator";

export class RoleModulePermissionDto {
    @IsNumber()
    role_id: number;

    @IsNumber()
    module_id: number;

    @IsOptional()
    @IsBoolean()
    can_view?: boolean;

    @IsOptional()
    @IsBoolean()
    can_edit?: boolean;

    @IsOptional()
    @IsBoolean()
    can_delete?: boolean;

    @IsOptional()
    @IsBoolean()
    can_create?: boolean;
} 