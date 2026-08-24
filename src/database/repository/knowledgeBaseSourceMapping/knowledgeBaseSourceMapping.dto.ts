import {
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    ValidateIf,
    IsJSON,
} from 'class-validator';

export class KnowledgeBaseSourceMappingDto {
    @ValidateIf((object) => object.id !== undefined)
    @IsInt({ message: 'id must be an integer' })
    @IsNotEmpty({ message: 'id is required' })
    id!: number;

    @IsOptional()
    @IsInt({ message: 'knowledge_base_id must be an integer' })
    @ValidateIf((object) => object.id === undefined)
    @IsNotEmpty({ message: 'knowledge_base_id is required' })
    knowledge_base_id: number;

    @IsOptional()
    @IsInt({ message: 'source_type_id must be an integer' })
    @ValidateIf((object) => object.id === undefined)
    @IsNotEmpty({ message: 'source_type_id is required' })
    source_type_id: number;

    @IsOptional()
    @IsInt({ message: 'cloud_provider_id must be an integer' })
    cloud_provider_id?: number;

    @IsOptional()
    @IsInt({ message: 'cloud_secret_id must be an integer' })
    cloud_secret_id?: number;

    @IsOptional()
    @IsInt({ message: 'region_id must be an integer' })
    region_id?: number;

    @IsOptional()
    source_details?: any;

    @IsOptional()
    @IsString({ message: 'status must be a string' })
    status?: string;

    @IsOptional()
    @IsInt({ message: 'member_id must be an integer' })
    member_id?: number;

    @IsOptional()
    last_sync_at?: Date;

    @IsOptional()
    next_sync_at?: Date;
}
