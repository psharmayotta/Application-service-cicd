import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsBoolean,
    MaxLength,
} from 'class-validator';

export class KnowledgeBaseSourceDto {
    @IsString({ message: 'Name must be a string' })
    @IsNotEmpty({ message: 'Name is required' })
    @MaxLength(255, { message: 'Name cannot exceed 255 characters' })
    name: string;

    @IsString({ message: 'Description must be a string' })
    @IsOptional()
    description?: string;

    @IsString({ message: 'Type must be a string' })
    @IsNotEmpty({ message: 'Type is required' })
    @MaxLength(100, { message: 'Type cannot exceed 100 characters' })
    type: string;

    @IsString({ message: 'Icon must be a string' })
    @IsOptional()
    icon?: string;

    @IsBoolean({ message: 'Status must be a boolean' })
    @IsOptional()
    status?: boolean;
}
