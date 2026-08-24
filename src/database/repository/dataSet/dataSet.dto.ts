
import { ValidateIf, IsNumber, IsNotEmpty, IsString, Length, Matches, ArrayNotEmpty, Validate, IsEnum, IsInt, IsJSON, IsOptional, MaxLength } from "class-validator";
import { FileExistsValidator } from "../../../core/FileExistValidatorfn";
import { DatasetFormat, DatasetType } from "../../../config";

export class DataSetDto {
    @IsInt()
    @IsOptional()
    company_id: number;

    @IsInt()
    @IsOptional()
    member_id: number;

    @IsInt()
    @IsOptional()
    training_id: number;

    @IsString()
    @MaxLength(255)
    name: string;

    @IsString()
    description: string;

    @IsInt()
    cloud_service_id: number;

    @IsOptional()
    @IsString()
    dataset_path?: string;

    @IsOptional()
    @IsInt()
    cloud_secret_id?: number;

    @IsOptional()
    @IsInt()
    region_id?: number;

    @IsEnum(DatasetType)
    type: DatasetType;

    @IsOptional()
    @IsString()
    uri?: string;

    @IsEnum(DatasetFormat)
    data_format: DatasetFormat;

    @IsOptional()
    meta_data?: any;

    @IsOptional()
    @IsString()
    size?: string;

    @IsOptional()
    @IsString()
    failure_message?: string;

    @IsOptional()
    @IsString()
    module_name?: string;

    @IsOptional()
    @IsInt()
    category_id?: number;


    // @ValidateIf((object) => {
    //     return (
    //         !object.id ||
    //         (object.id && Array.isArray(object.files) && object.files.some(f => f.fieldname === 'dataset_file'))
    //     );
    // })
    // @ArrayNotEmpty()
    // @Validate(FileExistsValidator, {
    //     message: 'Enter a file or file not valid',
    // })
    // files!: [];
}
