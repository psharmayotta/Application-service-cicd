import { Transform } from "class-transformer";
import {
    ArrayNotEmpty,
    IsArray,
    IsIn,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Matches,
    ValidateIf
} from "class-validator";
import { InfraNodesStatus } from "../../../config";

export class InfraNodesDto {
    @ValidateIf((object) => object.id !== undefined)
    @IsNumber()
    @IsNotEmpty({ message: 'Hardware specs id is required' })
    id!: number;

    @Transform(({ value }) => value?.trim())
    @IsString()
    @IsNotEmpty({ message: 'Hostname is required' })
    hostname!: string;

    @Transform(({ value }) => value?.trim())
    @IsString()
    @IsNotEmpty({ message: 'Location is required' })
    location!: string;

    @IsNumber()
    @IsNotEmpty({ message: 'Rack ID is required' })
    rack_id!: number;

    @IsNumber()
    @IsNotEmpty({ message: 'Region ID is required' })
    region_id!: number;

    @IsNumber()
    @IsNotEmpty({ message: 'Zone ID is required' })
    zone_id!: number;

    @IsNumber()
    @IsNotEmpty({ message: 'Cloud Provider ID is required' })
    cloud_provider_id!: number;

    @IsArray({ message: 'Hardware Specs IDs must be an array of numbers' })
    @ArrayNotEmpty({ message: 'Hardware Specs IDs are required' })
    @IsNumber({}, { each: true, message: 'Each Hardware Specs ID must be a number' })
    hardware_specs_ids!: number[];

    @Transform(({ value }) => value?.trim())
    @IsString()
    @IsNotEmpty({ message: 'IP Address is required' })
    @Matches(
        /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/,
        { message: 'Invalid IP address format' }
    )
    ip_address!: string;

    @Transform(({ value }) => value?.trim())
    @IsString()
    @IsNotEmpty({ message: 'MAC Address is required' })
    @Matches(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, {
        message: 'Invalid MAC address format',
    })
    mac_address!: string;

    @Transform(({ value }) => value?.trim())
    @IsString()
    @IsNotEmpty({ message: 'Serial number is required' })
    serial_number!: string;

    @IsOptional()
    @Transform(({ value }) => (value === null || value === '' ? undefined : value?.trim()))
    @IsString()
    @IsIn(Object.values(InfraNodesStatus), {
        message: `Status must be one of: ${Object.values(InfraNodesStatus).join(', ')}`,
    })
    status?: InfraNodesStatus;

    @IsOptional()
    @IsNumber()
    owner_project_id?: number;
}
