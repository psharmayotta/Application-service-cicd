import { IsDateString, IsNumber, IsOptional, IsString } from "class-validator";

export class ReservationDto {
    @IsNumber()
    infra_node_id: number;

    @IsNumber()
    accelerator_count: number;

    @IsNumber()
    region_id: number;

    @IsDateString()
    start_date: Date;

    @IsDateString()
    end_date: Date;

    @IsString()
    @IsOptional()
    status: string;
}