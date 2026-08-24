import { InferModel } from "../InferModel/InferModel.model";

export class HardwareUtilizationModel extends InferModel {
    id: number = null;
    created_at: Date = null;
    pod_id: number = null;
    infra_allocation_id: number = null;
    node_id: number = null;
    container_name: string = '';
    timestamp: Date = null;
    cpu_usage_cores: number = null;
    cpu_usage_percent: number = null;
    memory_usage_mb: number = null;
    memory_percent: number = null;
    gpu_usage_percent: number = null;
    gpu_memory_used_mb: number = null;
    network_rx_bytes: number = null;
    network_tx_bytes: number = null;
    disk_read_bytes: number = null;
    disk_write_bytes: number = null;
    metrics_metadata: object = {};
}
