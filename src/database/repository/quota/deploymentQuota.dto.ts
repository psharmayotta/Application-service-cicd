import { IsDate, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

export class DeploymentQuotaDto {
    @IsNumber()
    model_id: number;

    @IsNumber()
    tpm_limit: number;

    @IsNumber()
    rpm_limit: number;

    @IsNumber()
    @IsOptional()
    extended_tpm_limit: number;

    @IsNumber()
    @IsOptional()
    extended_rpm_limit: number;

    @IsNumber()
    company_id: number;

    @IsString()
    @IsOptional()
    @MaxLength(150)
    reason: string;
}