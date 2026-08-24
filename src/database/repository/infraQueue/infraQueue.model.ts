import { InfraQueueModuleType, InfraQueueStatus } from '../../../config';
import { InferModel } from '../InferModel/InferModel.model';

export class InfraQueueModel extends InferModel {
    module_type: InfraQueueModuleType = null;
    module_id: number = null;
    accelerator_id: number = null;
    accelerator_count: number = 1;
    priority: number = 0;
    status: InfraQueueStatus = InfraQueueStatus.PENDING;
    payload: any = null;
    error_message: string = null;
    retry_count: number = 0;
    company_id: number = null;
    member_id: number = null;
    decryptToken: any = null;
}
