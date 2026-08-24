import { InferModel } from "../InferModel/InferModel.model";
import { BatchJobStatus } from "../../../config";

export class BatchInferenceModel extends InferModel {
    name: string = "";
    description: string = "";
    cloud_provider_id: number = 0;
    base_model_id: number | null = null;
    model_class: string | null = null;
    model_path: string | null = null;
    model_type: string | null = null;
    dataset_id: number = null;
    configuration: any = null;
    member_id: number = 0;
    company_id: number = 0;
    secret_id: number | null = null;
    sync_frequency: string = 'none';
    sync_time: string | null = null;
    sync_day: string | null = null;
    is_sync_enabled: boolean = true;
    last_run_at: Date | null = null;
    next_run_at: Date | null = null;
    is_active: boolean = true;
    decryptToken?: any = null;
    status: BatchJobStatus = BatchJobStatus.PENDING;
    cloud_provider: number | null = null;
    storage_path: string | null = null;
    cloud_secret_id: number | null = null;
}
