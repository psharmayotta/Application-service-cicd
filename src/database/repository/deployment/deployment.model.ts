import { DEPLOYMENTPROCESS, NodeAntiAffinity, DeploymentType } from "../../../config";
import { InferModel } from "../InferModel/InferModel.model";

export class DeploymentModel extends InferModel {
    node_id: number = null;
    module_id: number = null;
    model_id: number = null;
    user_id: number = null;
    company_id: number = null;
    module_type_id: number = null;
    deployment_name: string = '';
    deployment_type: DeploymentType = DeploymentType.PLAYGROUND;
    description: string = '';
    gpu_type: string = '';
    cpu_cores: number = null;
    gpu_count_per_pod: number | string = null;
    slug: string = '';
    cluster_id: number = null;
    scaling_parameters: any[] = null;
    min_pod_count: number = null;
    max_pod_count: number = null;
    scaling_metric: object = {};
    node_anti_affinity: NodeAntiAffinity = NodeAntiAffinity.NOTREQUIRED;
    rapid_autoscaling: boolean = false;
    decryptToken: { member_id?: number, email?: string } = {}
    node_groups: Array<number> = []
    scaling: any = null;
    config: any = null;
    deployment_status: DEPLOYMENTPROCESS = DEPLOYMENTPROCESS.CREATE;
    model_proxy: string = 'https://adminapi-alpha.q0.new/inference/api/inference/api-key';
    module_type: string = 'deployment';
    model_grpc: string = '0.0.0.0:50051';
    inference_engine: string = null;
}