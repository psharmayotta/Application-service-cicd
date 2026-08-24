import { InferModel } from '../InferModel/InferModel.model';
import { KnowledgeBaseJobStatus } from '../../../config';

export class KnowledgeBaseJobModel extends InferModel {
    knowledge_base_id: number = 0;
    company_id: number = 0;
    status: KnowledgeBaseJobStatus = KnowledgeBaseJobStatus.PENDING;
}
