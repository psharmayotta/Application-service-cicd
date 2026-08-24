import { NodeAntiAffinity } from "../../../config";
import { InferModel } from "../InferModel/InferModel.model";

export class PodDetailsModel extends InferModel {
    infra_allocation_id: number = null;
    pod_name: string = '';
    namespace: string = '';
    status: string = '';
    node_id: number = null;
    host_ip: string = '';
    pod_ip: string = '';
    restart_count: number = 0;
    start_time: Date = null;
    end_time: Date = null;
    cpu_request: number = null;
    cpu_limit: number = null;
    memory_request_mb: number = null;
    memory_limit_mb: number = null;
    gpu_request: number = null;
    gpu_memory_mb: number = null;
    volume_mounts: object = {};
    labels: object = {};
    annotations: object = {};
    logs_path: string = '';
    min_pod_count: number = null;
    max_pod_count: number = null;
    scaling_metric: object = {};
    node_anti_affinity: NodeAntiAffinity = NodeAntiAffinity.NOTREQUIRED;
    rapid_autoscaling: boolean = false;
    config: object = {};
}
