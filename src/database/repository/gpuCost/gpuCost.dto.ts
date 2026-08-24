import { IsNumber, IsNotEmpty } from "class-validator";

export class GpuCostDto {
    @IsNumber()
    @IsNotEmpty()
    company_id: number;
}
