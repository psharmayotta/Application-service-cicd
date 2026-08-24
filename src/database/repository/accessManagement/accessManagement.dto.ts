import { IsNotEmpty, IsNumber, ValidateIf } from "class-validator";

export class AccessManagementDto {

    @ValidateIf((o, v) => o.id !== undefined)
    @IsNumber()
    @IsNotEmpty({ message: 'Allocation id is required' })
    id!: number;
}