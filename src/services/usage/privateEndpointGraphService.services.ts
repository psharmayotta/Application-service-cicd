import { AwsService } from "../../core/AwsService";
import { PodLogModel } from "../../database/repository/podLog/podLog.model";
import { PodLogEntity } from "../../entities/podLogEntity";
import { BaseServices } from "../baseService.services";
import Database from "../../database/database";
import { TimeZone } from "../../config";
import { toUTC } from "../../utils/dateFormatter/dateFormatter";
import moment from "moment";

class PrivateEndPointGraphService extends BaseServices {
    constructor(entity: any = PodLogEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): PodLogModel {
        return new PodLogModel();
    }

    getDTO() {
        return '';
    }

    getModuleName(): string {
        return 'Private Endpoint Graph';
    }

    private formatUsageDate(value: Date | string, timezone: TimeZone | string): string {
        switch (timezone) {
            case TimeZone.Asia:
            case TimeZone.LOCAL:
                return moment.utc(value).utcOffset(330).format('YYYY-MM-DD HH:mm:ss');
            default:
                return moment.utc(value).format('YYYY-MM-DD HH:mm:ss');
        }
    }

    async getGraph(param: any): Promise<any> {
        try {
            if (param.company_id === undefined || param.company_id === null || typeof param.company_id !== 'number') {
                return Promise.reject('E10020');
            }

            if (!param.start_date || !param.end_date) {
                return Promise.reject('E10021');
            }

            const isLocalTimezone = param.timezone === TimeZone.LOCAL;
            if (isLocalTimezone) {
                param.start_date = toUTC(param.start_date);
                param.end_date = toUTC(param.end_date);
            }

            const dbConnection = Database.getInstance();
            const timezone = param.timezone || TimeZone.UTC;

            const getUsageQuery = `
            SELECT
                ia.id AS infra_id,
                ia.deployment_name,
                COALESCE(hm.model_name, '') AS gpu_name,
                COALESCE(ia.gpu_count_per_pod::varchar, '0') AS gpu_count_per_pod,
                wt.created_at AT TIME ZONE 'UTC' AS usage_time,
                ROUND(SUM(wt.amount), 5) AS total_amount
            FROM price_schema.wallet_transactions wt
            JOIN infra_schema.pod_details pd ON pd.id::varchar = wt.reference_id
            JOIN infra_schema.infra_allocation ia ON pd.infra_allocation_id = ia.id
            LEFT JOIN model.model m ON m.id = ia.module_id AND m.is_delete = 0
            LEFT JOIN infra_schema.hardware_specs hs ON hs.id = m.accelerator_id AND hs.is_delete = 0
            LEFT JOIN infra_schema.hardware_master hm ON hm.id = hs.hardware_master_id AND hm.is_delete = 0
            WHERE wt.reference_type = 'DEPLOYMENT'
            AND wt.type = 'DEBIT'
            AND wt.status = 'SUCCESS'
            AND wt.is_delete = 0
            AND pd.is_delete = 0
            --AND ia.is_delete = 0
            AND ia.company_id = ${param.company_id}
            AND (wt.created_at AT TIME ZONE 'UTC')
                BETWEEN ('${param.start_date}')::timestamptz AND ('${param.end_date}')::timestamptz
            GROUP BY ia.id, ia.deployment_name, gpu_name, ia.gpu_count_per_pod, wt.created_at
            ORDER BY usage_time ASC, ia.id ASC`;

            const usageData: any[] = await dbConnection.executeExternalQuery(getUsageQuery, []);

            const getPodLogQuery = `
            SELECT
                ia.id AS infra_id,
                ia.deployment_name,
                COALESCE(hm.model_name, '') AS gpu_name,
                COALESCE(ia.gpu_count_per_pod::varchar, '0') AS gpu_count_per_pod,
                pl.pod_name,
                UPPER(pl.status) AS status,
                pl.timestamp AT TIME ZONE 'UTC' AS log_time
            FROM infra_schema.pod_logs pl
            JOIN infra_schema.infra_allocation ia ON ia.id = pl.infra_allocation_id
            LEFT JOIN model.model m ON m.id = ia.module_id AND m.is_delete = 0
            LEFT JOIN infra_schema.hardware_specs hs ON hs.id = m.accelerator_id AND hs.is_delete = 0
            LEFT JOIN infra_schema.hardware_master hm ON hm.id = hs.hardware_master_id AND hm.is_delete = 0
            WHERE pl.is_delete = 0
            AND ia.company_id = ${param.company_id}
            AND (pl.timestamp AT TIME ZONE 'UTC') <= ('${param.end_date}')::timestamptz
            AND UPPER(pl.status) IN ('START', 'READY', 'END', 'DELETED', 'FAILED')
            ORDER BY ia.id ASC, pl.pod_name ASC, pl.timestamp ASC`;

            const podLogData: any[] = await dbConnection.executeExternalQuery(getPodLogQuery, []);

            const costs: Array<{ usage_date: string; id: number; deployment_name: string; total_cost: number }> = [];
            const node_minutes: Array<{ usage_date: string; id: number; deployment_name: string; total_minutes: number }> = [];

            const deploymentMap = new Map<number, {
                id: number;
                deployment_name: string;
                gpu_name: string;
                gpu_count_per_pod: number | string;
                total_cost: number;
                total_node_minutes: number;
                peak_nodes: number;
                cost_started_at: string | null;
                first_usage_date: string | null;
                last_usage_date: string | null;
                lifecycle_events: Array<{ time: number; delta: number }>;
            }>();

            let totalCost = 0;
            let totalNodeMinutes = 0;

            for (const row of usageData) {
                const usage_date = this.formatUsageDate(row.usage_time, timezone);

                const id = Number(row.infra_id);
                const deployment_name = row.deployment_name;
                const gpu_name = row.gpu_name || '';
                const gpu_count_per_pod = row.gpu_count_per_pod;
                const total_cost = Number(row.total_amount || 0);

                costs.push({ usage_date, id, deployment_name, total_cost });
                totalCost += total_cost;

                const existing = deploymentMap.get(id);
                if (existing) {
                    existing.total_cost += total_cost;
                    if (!existing.first_usage_date || usage_date < existing.first_usage_date) {
                        existing.first_usage_date = usage_date;
                    }
                    if (!existing.last_usage_date || usage_date > existing.last_usage_date) {
                        existing.last_usage_date = usage_date;
                    }
                    existing.total_cost = Number(existing.total_cost.toFixed(5));
                } else {
                    deploymentMap.set(id, {
                        id,
                        deployment_name,
                        gpu_name,
                        gpu_count_per_pod,
                        total_cost,
                        total_node_minutes: 0,
                        peak_nodes: 0,
                        cost_started_at: null,
                        first_usage_date: usage_date,
                        last_usage_date: usage_date,
                        lifecycle_events: [],
                    });
                }
            }

            const rangeStart = new Date(param.start_date);
            const rangeEnd = new Date(param.end_date);
            const nodeMinuteMap = new Map<string, { usage_date: string; id: number; deployment_name: string; total_minutes: number }>();
            const podStateMap = new Map<string, Date | null>();

            for (const row of podLogData) {
                const id = Number(row.infra_id);
                const deployment_name = row.deployment_name;
                const gpu_name = row.gpu_name || '';
                const gpu_count_per_pod = row.gpu_count_per_pod;
                const podName = row.pod_name;
                const status = String(row.status || '').toUpperCase();
                const logTime = new Date(row.log_time);
                const podKey = `${id}::${podName}`;

                let deployment = deploymentMap.get(id);
                if (!deployment) {
                    deployment = {
                        id,
                        deployment_name,
                        gpu_name,
                        gpu_count_per_pod,
                        total_cost: 0,
                        total_node_minutes: 0,
                        peak_nodes: 0,
                        cost_started_at: null,
                        first_usage_date: null,
                        last_usage_date: null,
                        lifecycle_events: [],
                    };
                    deploymentMap.set(id, deployment);
                }

                if (status === 'READY') {
                    podStateMap.set(podKey, logTime);
                    const formattedReadyTime = this.formatUsageDate(logTime, timezone);
                    if (!deployment.cost_started_at || formattedReadyTime < deployment.cost_started_at) {
                        deployment.cost_started_at = formattedReadyTime;
                    }
                    continue;
                }

                if (status === 'START') {
                    if (!podStateMap.get(podKey)) {
                        podStateMap.set(podKey, logTime);
                    }
                    continue;
                }

                if (!['END', 'DELETED', 'FAILED'].includes(status)) {
                    continue;
                }

                const activeStart = podStateMap.get(podKey);
                if (!activeStart) {
                    continue;
                }

                const clippedStart = new Date(Math.max(activeStart.getTime(), rangeStart.getTime()));
                const clippedEnd = new Date(Math.min(logTime.getTime(), rangeEnd.getTime()));

                if (clippedEnd > clippedStart) {
                    const totalMinutes = Number(((clippedEnd.getTime() - clippedStart.getTime()) / 60000).toFixed(2));
                    const usage_date = this.formatUsageDate(clippedEnd, timezone);
                    const nodeMinuteKey = `${id}::${usage_date}`;
                    const existingNodeMinute = nodeMinuteMap.get(nodeMinuteKey);

                    if (existingNodeMinute) {
                        existingNodeMinute.total_minutes = Number((existingNodeMinute.total_minutes + totalMinutes).toFixed(2));
                    } else {
                        nodeMinuteMap.set(nodeMinuteKey, {
                            usage_date,
                            id,
                            deployment_name,
                            total_minutes: totalMinutes,
                        });
                    }

                    deployment.total_node_minutes = Number((deployment.total_node_minutes + totalMinutes).toFixed(2));
                    totalNodeMinutes = Number((totalNodeMinutes + totalMinutes).toFixed(2));
                    deployment.lifecycle_events.push(
                        { time: clippedStart.getTime(), delta: 1 },
                        { time: clippedEnd.getTime(), delta: -1 }
                    );
                }

                podStateMap.set(podKey, null);
            }

            for (const [podKey, activeStart] of podStateMap.entries()) {
                if (!activeStart) {
                    continue;
                }

                const [infraId] = podKey.split('::');
                const id = Number(infraId);
                const deployment = deploymentMap.get(id);
                if (!deployment) {
                    continue;
                }

                const clippedStart = new Date(Math.max(activeStart.getTime(), rangeStart.getTime()));
                const clippedEnd = rangeEnd;

                if (clippedEnd > clippedStart) {
                    const totalMinutes = Number(((clippedEnd.getTime() - clippedStart.getTime()) / 60000).toFixed(2));
                    const usage_date = this.formatUsageDate(clippedEnd, timezone);
                    const nodeMinuteKey = `${id}::${usage_date}`;
                    const existingNodeMinute = nodeMinuteMap.get(nodeMinuteKey);

                    if (existingNodeMinute) {
                        existingNodeMinute.total_minutes = Number((existingNodeMinute.total_minutes + totalMinutes).toFixed(2));
                    } else {
                        nodeMinuteMap.set(nodeMinuteKey, {
                            usage_date,
                            id,
                            deployment_name: deployment.deployment_name,
                            total_minutes: totalMinutes,
                        });
                    }

                    deployment.total_node_minutes = Number((deployment.total_node_minutes + totalMinutes).toFixed(2));
                    totalNodeMinutes = Number((totalNodeMinutes + totalMinutes).toFixed(2));
                    deployment.lifecycle_events.push(
                        { time: clippedStart.getTime(), delta: 1 },
                        { time: clippedEnd.getTime(), delta: -1 }
                    );
                }
            }

            node_minutes.push(
                ...Array.from(nodeMinuteMap.values()).sort((a, b) =>
                    new Date(a.usage_date).getTime() - new Date(b.usage_date).getTime()
                )
            );

            const deployments = Array.from(deploymentMap.values())
                .map((item) => ({
                    peak_nodes: item.lifecycle_events
                        .sort((a, b) => (a.time - b.time) || (b.delta - a.delta))
                        .reduce((state, event) => {
                            state.current += event.delta;
                            state.max = Math.max(state.max, state.current);
                            return state;
                        }, { current: 0, max: 0 }).max,
                    id: item.id,
                    name: item.deployment_name,
                    gpu: item.gpu_name
                        ? `${item.gpu_name}${item.gpu_count_per_pod ? ` (${item.gpu_count_per_pod}xGPU)` : ''}`
                        : `${item.gpu_count_per_pod || 0}xGPU`,
                    cost_started_at: item.cost_started_at,
                    first_usage_date: item.first_usage_date,
                    last_usage_date: item.last_usage_date,
                    node_minutes: item.total_node_minutes,
                    total_amount: Number(item.total_cost.toFixed(5)),
                }))
                .sort((a, b) => {
                    const aTime = a.last_usage_date ? new Date(a.last_usage_date).getTime() : 0;
                    const bTime = b.last_usage_date ? new Date(b.last_usage_date).getTime() : 0;
                    return bTime - aTime;
                })
                .slice(0, 6);

            return Promise.resolve({
                costs,
                node_minutes,
                deployments,
                totalCost: Number(totalCost.toFixed(5)),
                totalNodeMinutes,
            });
        } catch (error) {
            console.log('------PrivateEndPointGraphService getGraph------', error);
            return Promise.reject(error);
        }
    }
}

export default PrivateEndPointGraphService;
