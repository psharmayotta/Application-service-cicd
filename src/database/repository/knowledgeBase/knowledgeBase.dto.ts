import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsInt,
    IsBoolean,
    IsObject,
    MaxLength,
    Min,
    Max,
    ValidateIf,
    IsIn,
    Matches
} from 'class-validator';

export class KnowledgeBaseDto {
    @ValidateIf((object) => object.id !== undefined)
    @IsInt({ message: 'ID must be an integer' })
    @IsNotEmpty({ message: 'ID is required' })
    id?: number;

    @IsOptional()
    @IsInt({ message: 'Company ID must be an integer' })
    company_id: number;

    @ValidateIf((o) => !o.id || o.name !== undefined)
    @IsString({ message: 'Name must be a string' })
    @IsNotEmpty({ message: 'Name is required' })
    @MaxLength(255, { message: 'Name cannot exceed 255 characters' })
    @Matches(/^[^<>]*$/, { message: 'Name must not contain HTML tags or special characters like < >' })
    name: string;

    @IsString({ message: 'Description must be a string' })
    @IsOptional()
    description?: string;

    @IsObject({ message: 'Source details must be an object' })
    @IsOptional()
    source_details?: any;

    @IsObject({ message: 'Chunking details must be an object' })
    @IsOptional()
    chunking_details?: any;

    @IsObject({ message: 'Embedding details must be an object' })
    @IsOptional()
    embedding_details?: any;

    @IsObject({ message: 'Vector store details must be an object' })
    @IsOptional()
    vector_store_details?: any;

    @IsOptional()
    @IsBoolean({ message: 'Auto sync must be a boolean' })
    auto_sync?: boolean;

    @IsOptional()
    @IsString({ message: 'Sync frequency must be a string' })
    @IsIn(["none", "daily", "weekly", "hourly", "monthly"], { message: "Invalid sync frequency" })
    sync_frequency?: string;

    @ValidateIf((o) => o.sync_frequency === "daily" || o.sync_frequency === "weekly")
    @IsNotEmpty({ message: "Sync time is required for daily and weekly frequencies" })
    @IsString({ message: "Sync time must be a string" })
    @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: "Sync time must be in HH:mm format" })
    sync_time?: string;

    @ValidateIf((o) => o.sync_frequency === "weekly")
    @IsNotEmpty({ message: "Sync day is required for weekly frequency" })
    @IsInt({ message: "Sync day must be an integer" })
    @Min(0)
    @Max(6)
    sync_day?: number;
}

export class SyncNowDto {
    @IsInt({ message: 'Knowledge Base ID must be an integer' })
    @IsNotEmpty({ message: 'Knowledge Base ID is required' })
    knowledge_base_id: number;
}
