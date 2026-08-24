import { BenchmarkingType, HardwareComponentType, ModuleType, PrivateEndPointPresetFilter, UsagePresetFilter } from "../config";

export class InferParams {
    id: number = null;
    member_id: number = null;
    company_id: number = null;
}

export class Filter extends InferParams {
    search: string = '';
    year: string = ''
    secret_type: number = null;
    usage_status: string = null;
}

export class Pagination extends InferParams {
    pageSize: number = 25;
    pageNumber: number = 0;
    filter: Filter = { id: null, member_id: null, company_id: null, search: '', year: '', secret_type: null, usage_status: null };
    sortBy: string = null;
    sortType: string = null;
    company_id: number = null;
    search_text: string = null;
    decryptToken: any = null;
    is_delete: number = null;
}

export class KnowledgeBaseFilter extends Pagination {
    chunking_type?: string = null;
    status?: string = null;
    knowledge_base_id?: number = null;
}




export class ModelFilter extends Pagination {
    model_libararies_id: number = null;
    model_task_id: number = null;
    model_category_id: number = null;
    model_gpu_id: number = null;
    model_licenses_id: number = null;
    model_provider_id: number = null;
    model_source_id: number = null;
    model_type_id: number = null;
    allow_training: boolean = null;
    allow_playground: boolean = null;
    search_text: string = null;
    is_new: number = null;
    is_popular: number = null;
    is_suggetion: number = null;
}

export class ChatFilter extends Pagination {
    chat_session_id: number = null;
    api_key: string = null;
    start_date: string = null;
    end_date: string = null;
    model_ids: number[] = []
    timezone: string = null;
    model_id: number = null;
    preset_filter: UsagePresetFilter | PrivateEndPointPresetFilter = UsagePresetFilter.LAST_1_MONTH
}

export class CloudFilter extends Pagination {
    cloud_provider_id: number = null;
    cloud_zone_id: number = null;
    isAvailable: number = 0;
    cloud_region_id: number = null;
    component_type: HardwareComponentType = null;
    hardware_id: number = null;
    assigned_core: number = null;
    module_id: number = null;
    cluster_id: number = null;
    module_name: ModuleType = null;
    cloud_account_id: number = null;

}

export class WalletFilter extends Pagination {
    wallet_id: number = null;
    start_date: string = null;
    end_date: string = null;
    reference_type: string = null;
}

export class BenchmarkingFilter extends Pagination {
    type: BenchmarkingType = null;
    status: string = null;
}

export class UpdateParams extends InferParams {
    full_name?: string;
    email?: string;
    mobile_no?: number;
}
