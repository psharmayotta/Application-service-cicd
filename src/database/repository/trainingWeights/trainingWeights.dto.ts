import { IsNotEmpty, IsNumber, IsString, IsOptional } from "class-validator";

export class TrainingWeightsDto {
    @IsNotEmpty()
    @IsNumber()
    training_id: number;

    @IsNotEmpty()
    @IsNumber()
    secret_id: number;

    @IsNotEmpty()
    @IsString()
    path: string;

    @IsNotEmpty()
    @IsNumber()
    cloud_provider: number;

    @IsOptional()
    @IsString()
    status: string;
}
