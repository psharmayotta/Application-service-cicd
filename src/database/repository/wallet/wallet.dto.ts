import { Type } from "class-transformer";
import { IsInt, IsNumber, IsOptional, Max, Min } from "class-validator";

export class WalletDto {
    @IsOptional()
    @IsNumber()
    id?: number;
}

export class CostForecastDto {
    @Type(() => Number)
    @IsInt()
    @Min(1)
    company_id: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(12)
    months?: number;
}
