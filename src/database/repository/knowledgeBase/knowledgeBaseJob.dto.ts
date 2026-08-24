import { IsInt, IsNotEmpty, IsOptional, IsString, IsEnum } from 'class-validator';
import { KnowledgeBaseJobStatus } from '../../../config';

export class KnowledgeBaseJobDto {
    @IsOptional()
    @IsInt()
    id?: number;

    @IsInt({ message: 'knowledge_base_id must be an integer' })
    @IsNotEmpty({ message: 'knowledge_base_id is required' })
    knowledge_base_id: number;

    @IsInt({ message: 'company_id must be an integer' })
    @IsNotEmpty({ message: 'company_id is required' })
    company_id: number;

    @IsEnum(KnowledgeBaseJobStatus)
    status: KnowledgeBaseJobStatus;
}
