import axios from 'axios';
import https from 'https';
import { LOKI_URL, TENANT_ID, LokiModule } from '../../config';
import { BaseServices } from '../baseService.services';
import { LokiLogModel } from '../../database/repository/lokiLog/lokiLog.model';
import { LokiLogDto } from '../../database/repository/lokiLog/lokiLog.dto';
import { ModelEntity } from '../../entities/modelEntity';
import { InfraAllocationEntity } from '../../entities/infraAllocationEntity';
import { ModelTrainingEntity } from '../../entities/modelTrainingEntity';
import { KnowledgeBaseEntity } from '../../entities/knowledgeBaseEntity';

export class LokiLogService extends BaseServices {

    constructor() {
        // Pass null/dummy values since we don't use DB/AWS for this service
        super(null as any, null as any);
    }

    getModel(): LokiLogModel {
        return new LokiLogModel();
    }

    getDTO() {
        return LokiLogDto;
    }

    getModuleName(): string {
        return 'Loki Logs';
    }

    async getExactLogs(model: LokiLogModel) {
        const { model_id, model_org, limit = 1000, hours_back = 24 } = model;
        const headers = { "X-Scope-OrgID": TENANT_ID };

        // Determine namespace based on module
        let namespace = process.env.MYMODEL_LOGS // Default
        if (model.module) {
            const moduleKey = model.module.toUpperCase();
            if (Object.keys(LokiModule).includes(moduleKey)) {
                namespace = LokiModule[moduleKey as keyof typeof LokiModule];
            }
        }

        // Build query
        let logql = `{namespace="${namespace}", model_id="${model_id}", model_org="${model_org}"}`;

        if (model.log_level) {
            logql += ` |~ "(?i)${model.log_level}"`;
        }

        // Calculate time range
        let endTime = model.end_time ? new Date(model.end_time) : new Date();
        let startTime: Date;

        if (model.start_time) {
            startTime = new Date(model.start_time);
        } else {
            let dbStartTime: Date | null = null;
            const moduleId = Number(model_id);

            if (model.module.toUpperCase() === 'MYMODEL') {
                const record = await ModelEntity.findOneBy({ id: moduleId, is_delete: 0 });
                if (record) dbStartTime = record.created_at;
            } else if (model.module.toUpperCase() === 'DEPLOYMENT') {
                const record = await InfraAllocationEntity.findOneBy({ id: moduleId, is_delete: 0 });
                if (record) dbStartTime = record.created_at;
            } else if (model.module.toUpperCase() === 'TRAINING') {
                const record = await ModelTrainingEntity.findOneBy({ id: moduleId, is_delete: 0 });
                if (record) dbStartTime = record.created_at;
            } else if (model.module.toUpperCase() === 'KNOWLEDGEBASE') {
                const record = await KnowledgeBaseEntity.findOneBy({ id: moduleId, is_delete: 0 });
                if (record) dbStartTime = record.created_at;
            }

            if (dbStartTime) {
                startTime = new Date(dbStartTime);
            } else {
                startTime = new Date(endTime.getTime() - (hours_back * 60 * 60 * 1000));
            }
        }

        // Convert to nanoseconds
        const startNs = BigInt(startTime.getTime()) * BigInt(1000000);
        const endNs = BigInt(endTime.getTime()) * BigInt(1000000);

        const params = {
            query: logql,
            start: startNs.toString(),
            end: endNs.toString(),
            limit: limit,
            direction: "backward" // Backward = newest to oldest
        };

        const url = `${LOKI_URL}/api/v1/query_range`;

        // Create an https agent that ignores SSL errors
        const httpsAgent = new https.Agent({
            rejectUnauthorized: false
        });

        try {
            const response = await axios.get(url, {
                headers: headers,
                params: params,
                httpsAgent: httpsAgent
            });

            const data = response.data;
            const logs: any[] = [];

            if (data.status === 'success' && data.data && data.data.result) {
                for (const result of data.data.result) {
                    const labels = result.stream;

                    for (const [timestampNs, logLine] of result.values) {
                        try {
                            const logJson = JSON.parse(logLine);
                            logs.push({
                                timestamp: logJson['@timestamp'],
                                message: logJson['message'],
                                pod: labels['pod_name'],
                                namespace: labels['namespace'],
                                app: labels['app'],
                                container: labels['container_name'],
                                stream: labels['stream']
                            });
                        } catch (e) {
                            // If not JSON, add raw log
                            logs.push({
                                timestamp: timestampNs,
                                message: logLine,
                                pod: labels['pod_name']
                            });
                        }
                    }
                }
            }
            return logs;

        } catch (error) {
            console.error("Error fetching logs from Loki:", error);
            throw error;
        }
    }
}
