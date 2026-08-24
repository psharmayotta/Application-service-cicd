import { InfraAllocationModuleType, InfraAllocationStatus } from "../../../config";
import { InferModel } from "../InferModel/InferModel.model";

export class AllocationModel extends InferModel {
    id: number = null;
    created_at: Date = null;
    modified_at: Date = null;
    is_delete: number = 0;
    node_id: number = null;
    module_id: number = null;
    module_type: InfraAllocationModuleType.TRAINING = null;
    user_id: number = null;
    company_id: number = null;
    hardware_specs_id: number = null;
    vram_size_gb: number = null;
    allocation_time: Date = null;
    status: InfraAllocationStatus = null;
    model_endpoint: string = '';
    model_grpc: string = '';
    model_proxy: string = '';
    model_grpc_proto: string = '';
    model_protocol: string = '';
    module_type_id: number = null;
    deployment_name: string = '';
    slug: string = '';
    cluster_id: number = null;
    scaling_parameters: object = {};
}
