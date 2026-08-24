import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsBoolean,
    MaxLength,
} from 'class-validator';

export class KnowledgeBaseVectorStoreDto {
    @IsString({ message: 'Name must be a string' })
    @IsNotEmpty({ message: 'Name is required' })
    @MaxLength(255, { message: 'Name cannot exceed 255 characters' })
    name: string;

    @IsString({ message: 'Icon must be a string' })
    @IsOptional()
    icon?: string;

    @IsBoolean({ message: 'Coming soon must be a boolean' })
    @IsOptional()
    coming_soon?: boolean;

    @IsBoolean({ message: 'Status must be a boolean' })
    @IsOptional()
    status?: boolean;
}
