import { InferModel } from '../InferModel/InferModel.model';

export class KnowledgeBaseSourceMappingModel extends InferModel {
    knowledge_base_id: number = 0;
    source_type_id: number = 0;
    cloud_provider_id: number | null = null;
    cloud_secret_id: number | null = null;
    region_id: number | null = null;
    source_details: any = null;
    status: string = 'active';
    member_id: number | null = null;
    last_sync_at: Date | null = null;
    next_sync_at: Date | null = null;
    decryptToken: any = null;
}
