import axios from "axios";
import https from "https";
import { LOKI_URL, LOKI_METRICS_TENANT } from "../../config";
import { BaseServices } from "../baseService.services";
import { DeploymentMetricsDto } from "../../database/repository/deployment/deploymentMetrics.dto";
import { InfraAllocationEntity } from "../../entities/infraAllocationEntity";

export class DeploymentMetricsService extends BaseServices {
    constructor() {
        super(InfraAllocationEntity as any, null as any);
    }

    getModel(): any {
        return null;
    }

    getDTO(): any {
        return DeploymentMetricsDto;
    }

    getModuleName(): string {
        return "Deployment Metrics";
    }

    async getDeploymentMetrics(query: DeploymentMetricsDto): Promise<any> {
        const { deployment_id, hours, start, end, startDate: sd, endDate: ed, latest, limit = 100 } = query;
        const headers = { 'X-Scope-OrgID': LOKI_METRICS_TENANT };

        let startNs: string;
        let endNs: string;

        const now = new Date();
        const finalStart = sd || start;
        const finalEnd = ed || end;

        if (latest) {
            const startTime = new Date(now.getTime() - (60 * 60 * 1000)); // 1 hour ago
            startNs = (BigInt(startTime.getTime()) * BigInt(1000000)).toString();
            endNs = (BigInt(now.getTime()) * BigInt(1000000)).toString();
        } else if (finalStart && finalEnd) {
            const startDate = new Date(finalStart);
            const endDate = new Date(finalEnd);
            startNs = (BigInt(startDate.getTime()) * BigInt(1000000)).toString();
            endNs = (BigInt(endDate.getTime()) * BigInt(1000000)).toString();
        } else if (hours) {
            const startTime = new Date(now.getTime() - (hours * 60 * 60 * 1000));
            startNs = (BigInt(startTime.getTime()) * BigInt(1000000)).toString();
            endNs = (BigInt(now.getTime()) * BigInt(1000000)).toString();
        } else {
            // If no start date is provided, use the deployment's creation time
            try {
                const deployment: any = await this.findEntity(Number(deployment_id));
                const startDate = deployment && deployment.created_at ? new Date(deployment.created_at) : new Date(now.getTime() - (24 * 60 * 60 * 1000));
                startNs = (BigInt(startDate.getTime()) * BigInt(1000000)).toString();
                endNs = (BigInt(now.getTime()) * BigInt(1000000)).toString();
            } catch (e) {
                // Fallback to last 24 hours if deployment fetch fails
                const startDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
                startNs = (BigInt(startDate.getTime()) * BigInt(1000000)).toString();
                endNs = (BigInt(now.getTime()) * BigInt(1000000)).toString();
            }
        }

        const logql = `{deployment_id="${deployment_id}"}`;
        const url = `${LOKI_URL}/api/v1/query_range`;

        const params: any = {
            query: logql,
            start: startNs,
            end: endNs,
            limit: latest ? 1 : limit,
            direction: 'backward'
        };

        const httpsAgent = new https.Agent({
            rejectUnauthorized: false
        });

        try {
            console.log("Loki Query - URL:", url);
            console.log("Loki Query - Headers:", JSON.stringify(headers));
            console.log("Loki Query - Params:", JSON.stringify(params));

            const response = await axios.get(url, {
                headers,
                params,
                httpsAgent
            });

            const data = response.data;
            if (data.status !== 'success') {
                throw new Error("Loki query failed");
            }

            const results = data.data.result || [];
            const allRawEntries: any[] = [];

            for (const stream of results) {
                for (const value of stream.values) {
                    const [timestampNs, message] = value;
                    allRawEntries.push({
                        timestamp: timestampNs,
                        message: message
                    });
                }
            }

            // Sort entries by timestamp ascending for charts
            allRawEntries.sort((a, b) => (BigInt(a.timestamp) < BigInt(b.timestamp) ? -1 : 1));

            const formattedEntries = allRawEntries.map(entry => {
                const timestamp_human = new Date(Number(BigInt(entry.timestamp) / BigInt(1000000))).toISOString();
                return this.formatMetric({ ...entry, timestamp_human });
            });

            if (formattedEntries.length === 0) {
                return null;
            }

            const latestEntry = formattedEntries[formattedEntries.length - 1];

            const podNamesList = Array.from(new Set(
                formattedEntries.flatMap(e => (e.pod_metrics || []).map((p: any) => p.pod_name))
            ));

            // Build UI Response Object
            const uiResponse = {
                podNames: podNamesList,
                overview: {
                    totalRequests: latestEntry.requests.total || 0,
                    successfulRequest: latestEntry.requests.successful || 0,
                    activePods: latestEntry.performance.active_pods || 0,
                    totalPods: latestEntry.replicas.desired || 0,
                    throughput: latestEntry.requests.throughput || { value: 0, unit: "req/min" }
                },
                cpuUtilizationChart: formattedEntries.map(e => {
                    const pt: any = { time: e.timestamp_human, value: e.performance.cpu_utilization_num };
                    e.pod_metrics?.forEach((p: any) => { pt[p.pod_name] = p.cpu_utilization; });
                    return pt;
                }),
                gpuUtilizationChart: formattedEntries.map(e => {
                    const pt: any = { time: e.timestamp_human, value: e.performance.gpu_utilization_num };
                    e.pod_metrics?.forEach((p: any) => { pt[p.pod_name] = p.gpu_utilization; });
                    return pt;
                }),
                cpuMemoryChart: formattedEntries.map(e => {
                    const pt: any = { time: e.timestamp_human, value: e.performance.cpu_memory_gb };
                    e.pod_metrics?.forEach((p: any) => { pt[p.pod_name] = p.cpu_memory_gb; });
                    return pt;
                }),
                gpuMemoryChart: formattedEntries.map(e => {
                    const pt: any = { time: e.timestamp_human, value: e.performance.gpu_memory_gb };
                    e.pod_metrics?.forEach((p: any) => { pt[p.pod_name] = p.gpu_memory_gb; });
                    return pt;
                }),
                throughputChart: formattedEntries.map(e => ({ time: e.timestamp_human, value: e.requests.throughput_rpm })),
                httpStatusChart: formattedEntries.map(e => ({
                    time: e.timestamp_human,
                    "200": e.requests.http_2xx || 0,
                    "4xx": e.requests.http_4xx || 0,
                    "5xx": e.requests.http_5xx || 0
                })),
                latencyChart: formattedEntries.map(e => ({
                    time: e.timestamp_human,
                    p50: e.latency.p50_ms || 0,
                    p95: e.latency.p95_ms || 0,
                    p99: e.latency.p99_ms || 0
                })),
                latencyMetrics: {
                    p50_ms: latestEntry.latency.p50_ms || 0,
                    p95_ms: latestEntry.latency.p95_ms || 0,
                    p99_ms: latestEntry.latency.p99_ms || 0
                },
                activePodsChart: formattedEntries.map(e => ({
                    time: e.timestamp_human,
                    value: e.replicas?.available ?? e.performance?.active_pods ?? (e.full_data?.pods?.length || 0)
                })),
                modelPodsChart: formattedEntries.map((current, index) => {
                    const pods = current.replicas?.available ?? current.performance?.active_pods ?? (current.full_data?.pods?.length || 0);
                    let newPods = 0;
                    let highlight = false;

                    if (index > 0) {
                        const prev = formattedEntries[index - 1];
                        const prevPods = prev.replicas?.available ?? prev.performance?.active_pods ?? (prev.full_data?.pods?.length || 0);
                        if (pods > prevPods) {
                            newPods = pods - prevPods;
                            highlight = true;
                        }
                    }

                    return {
                        time: current.timestamp_human,
                        pods: pods,
                        newPods: newPods,
                        highlight: highlight
                    };
                }),
                podsTable: (latestEntry.full_data?.pods || []).map((p: any) => ({
                    podName: p.pod_name,
                    node: p.node,
                    podIP: p.pod_ip,
                    hostIP: p.host_ip,
                    status: p.status
                })),
                requestMetrics: {
                    total: latestEntry.requests.total || 0,
                    http1xx2xx: latestEntry.requests.http_2xx || 0,
                    http4xx: latestEntry.requests.http_4xx || 0,
                    http5xx: latestEntry.requests.http_5xx || 0
                },
                deploymentHealth: {
                    health: latestEntry.health,
                    state: latestEntry.state,
                    ready: latestEntry.replicas.ready,
                    available: latestEntry.replicas.available,
                    desired: latestEntry.replicas.desired
                }
            };

            return uiResponse;
        } catch (error: any) {
            console.error("Error querying Loki metrics:", error.message);
            throw error;
        }
    }

    private formatMetric(entry: any): any {
        try {
            let message = entry.message;
            if (typeof message === 'string') {
                try {
                    const messageObj = JSON.parse(message);
                    // The sample shows message can be a direct object or a stringified JSON within a 'message' field
                    if (messageObj && typeof messageObj === 'object' && 'message' in messageObj) {
                        try {
                            message = JSON.parse(messageObj.message);
                        } catch (e) {
                            message = messageObj;
                        }
                    } else {
                        message = messageObj;
                    }
                } catch (e) {
                    message = {};
                }
            }

            const status = message.status || {};
            const performance = message.performance || {};
            const gpu = performance.gpu || {};
            const cpu = performance.cpu || {};
            const request_metrics = message.request_metrics || {};
            const latency_metrics = message.latency_metrics || {};
            const overview = message.overview || {};
            const firstNumber = (...values: any[]): number => {
                for (const value of values) {
                    if (value != null && value !== "" && Number.isFinite(Number(value))) {
                        return Number(value);
                    }
                }
                return 0;
            };

            return {
                timestamp: entry.timestamp,
                timestamp_human: entry.timestamp_human,
                deployment_id: message.deployment_id,
                deployment_name: message.deployment_name,
                health: status.health,
                state: status.state,
                replicas: {
                    desired: status.desired_replicas || 0,
                    ready: status.ready_replicas || 0,
                    available: status.available_replicas || 0
                },
                performance: {
                    gpu_utilization_num: firstNumber(gpu.utilization_percent),
                    gpu_utilization: `${firstNumber(gpu.utilization_percent)}%`,
                    gpu_memory_gb: firstNumber(gpu.memory_utilization_gb, message.scaling?.gram_usage),
                    cpu_utilization_num: firstNumber(cpu.utilization_percent),
                    cpu_utilization: `${firstNumber(cpu.utilization_percent)}%`,
                    cpu_memory_gb: firstNumber(
                        cpu.memory_utilization_gb,
                        message.scaling?.ram_usage,
                        ...(message.pods || []).map((pod: any) => pod.ram_usage_gb)
                    ),
                    active_pods: firstNumber(overview.active_pods, message.pods?.length)
                },
                pod_metrics: (message.pods || []).map((pod: any) => {
                    let gpuUtil = 0;
                    let gpuMemGb = 0;
                    if (pod.gpu_uuid && gpu.metrics) {
                        const podGpu = gpu.metrics.find((m: any) => m.uuid === pod.gpu_uuid);
                        if (podGpu) {
                            gpuUtil = firstNumber(podGpu.utilization_percent);
                            gpuMemGb = podGpu.memory_used_bytes != null
                                ? (podGpu.memory_used_bytes / (1024 * 1024 * 1024))
                                : firstNumber(podGpu.memory_utilization_gb, podGpu.memory_used_gb, pod.gram_usage_gb, pod.gpu_memory_gb);
                        }
                    }
                    const cpuMetric = cpu.metrics?.find((m: any) => m.pod_name === pod.pod_name);
                    const cpuUtil = firstNumber(
                        pod.cpu_utilization_percent,
                        pod.cpu_usage_percent,
                        cpuMetric?.utilization_percent,
                        cpuMetric?.cpu_usage_percent
                    );
                    const cpuMemGb = firstNumber(
                        pod.cpu_memory_utilization_gb,
                        pod.ram_usage_gb,
                        pod.memory_utilization_gb,
                        pod.memory_usage_gb,
                        cpuMetric?.memory_utilization_gb,
                        cpuMetric?.memory_usage_gb,
                        cpuMetric?.memory_usage_mb != null ? Number(cpuMetric.memory_usage_mb) / 1024 : null
                    );

                    return {
                        pod_name: pod.pod_name,
                        gpu_utilization: gpuUtil,
                        gpu_memory_gb: gpuMemGb,
                        cpu_utilization: cpuUtil,
                        cpu_memory_gb: cpuMemGb
                    };
                }),
                requests: {
                    total: request_metrics.cumulative_total_requests || (Number(request_metrics.http_1xx_2xx || 0) + Number(request_metrics.http_4xx || 0) + Number(request_metrics.http_5xx || 0)) || 0,
                    successful: request_metrics.cumulative_successful_requests || request_metrics.http_1xx_2xx || overview.successful_requests || 0,
                    http_2xx: request_metrics.http_1xx_2xx || 0,
                    http_4xx: request_metrics.http_4xx || 0,
                    http_5xx: request_metrics.http_5xx || 0,
                    throughput_rpm: request_metrics.throughput_rpm || 0,
                    throughput: overview.throughput || { value: 0, unit: "req/min" }
                },
                latency: {
                    p50_ms: latency_metrics.p50_latency_ms || 0,
                    p95_ms: latency_metrics.p95_latency_ms || 0,
                    p99_ms: latency_metrics.p99_latency_ms || 0
                },
                full_data: message
            };
        } catch (e) {
            return { error: `Failed to parse message: ${e}`, raw: entry };
        }
    }
}
