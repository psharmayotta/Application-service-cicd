import {
    IsIn,
    IsNotEmpty,
    IsNumber,
    ValidateIf
} from "class-validator";
export class InfraSpecsMapperDto {
    @ValidateIf((object) => object.id !== undefined)
    @IsNumber()
    @IsNotEmpty({ message: 'Infra Specs Mapper id is required' })
    id!: number;

    @IsNumber()
    @IsNotEmpty({ message: 'Node ID is required' })
    node_id!: number;

    @IsNumber()
    @IsNotEmpty({ message: 'Hardware Specs ID is required' })
    hardware_specs_id!: number;
}
