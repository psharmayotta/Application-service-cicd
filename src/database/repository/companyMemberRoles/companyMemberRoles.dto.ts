import { IsBoolean, IsNumber, IsOptional } from "class-validator";

export class CompanyMemberRolesDto {
    @IsOptional()
    @IsNumber()
    company_id: number;

    @IsOptional()
    @IsNumber()
    member_id: number;

    @IsOptional()
    @IsNumber()
    role_id: number;

    @IsOptional()
    @IsBoolean()
    default_company: boolean;

    @IsOptional()
    @IsBoolean()
    active: boolean;
}
