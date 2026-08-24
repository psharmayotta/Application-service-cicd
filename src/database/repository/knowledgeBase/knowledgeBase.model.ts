import { ChunkingType, KnowledgeBaseSourceType, KnowledgeBaseStatus } from '../../../config';
import { InferModel } from '../InferModel/InferModel.model';

export class KnowledgeBaseModel extends InferModel {
    company_id: number = 0;
    member_id: number = 0;
    name: string = '';
    description: string | null = null;
    source_type_id: number = 0;
    cloud_provider_id: number | null = null;
    cloud_secret_id: number | null = null;
    region_id: number | null = null;
    auto_sync: boolean = false;
    sync_frequency: string | null = null;
    sync_time: string | null = null;
    sync_day: number | null = null;
    last_sync_at: Date | null = null;
    next_sync_at: Date | null = null;
    chunking_details: any = null;
    chunking_type: ChunkingType | null = null;
    embedding_details: any = null;
    embedding_model_id: number | null = null;
    vector_store_details: any = null;
    vector_store_id: number | null = null;
    status: KnowledgeBaseStatus = KnowledgeBaseStatus.PENDING;
    failure_message: string | null = null;

    source_details: any = null;

    decryptToken: any = null;
}
