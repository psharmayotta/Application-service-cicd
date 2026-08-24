import { AwsService } from "../../core/AwsService";
import { SecurityDto } from "../../database/repository/security/securityDto.dto";
import { InferModel } from "../../database/repository/InferModel/InferModel.model";
import { BaseServices } from "../baseService.services";
import { ChatSessionEntity } from "../../entities/chatSessionEntity";
import { ChatFilter, Pagination } from "../../core/InferParams";
import Database from "../../database/database";
import CryptoJS from "crypto-js";
import { PrivateEndPointPresetFilter, TimeZone, WalletTxnReferenceType } from "../../config";
import { toUTC } from "../../utils/dateFormatter/dateFormatter";
import moment from "moment";

class PrivateEndPointDashboardService extends BaseServices {
    constructor(entity: any = ChatSessionEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): InferModel {
        return new InferModel();
    }

    getDTO() {
        return SecurityDto;
    }

    override async prepareQuery(param: ChatFilter): Promise<any> {
        try {
            if (
                param.company_id === undefined ||
                param.company_id === null ||
                typeof param.company_id !== 'number'
            ) {
                return Promise.reject('E10020');
            }

            if (!param.start_date || !param.end_date) {
                return Promise.reject('E10021');
            }

            if (!param.model_ids || param.model_ids.length <= 0) {
                return Promise.reject('E10022');
            }

            const isLocalTimezone = param.timezone === 'Local (Browser timezone)';

            if (isLocalTimezone) {
                param.start_date = toUTC(param.start_date)
                param.end_date = toUTC(param.end_date)

                console.log('----------param------', param);

            }

            let bucketMinutes = 5; // default 5-min interval

            switch (param.preset_filter) {
                case PrivateEndPointPresetFilter.LAST_30_MIN: // 5-min buckets
                    bucketMinutes = 5;
                    break;

                case PrivateEndPointPresetFilter.LAST_2_HOUR: // 15-min buckets
                    bucketMinutes = 15;
                    break;

                case PrivateEndPointPresetFilter.LAST_12_HOUR: // 30-min buckets
                    bucketMinutes = 30;
                    break;

                case PrivateEndPointPresetFilter.LAST_24_HOUR: // 1-hour buckets
                    bucketMinutes = 60;
                    break;

                case PrivateEndPointPresetFilter.LAST_1_WEEK: // 6-hour buckets
                    bucketMinutes = 360;
                    break;

                case PrivateEndPointPresetFilter.LAST_1_MONTH: // 12-hour buckets
                    bucketMinutes = 720;
                    break;

                case PrivateEndPointPresetFilter.LAST_3_MONTH: // 24-hour buckets
                case PrivateEndPointPresetFilter.LAST_6_MONTH:
                case PrivateEndPointPresetFilter.LAST_1_YEAR:
                    bucketMinutes = 1440;
                    break;

                default:
                    bucketMinutes = 5;
                    break;
            }


            const dbConnection = Database.getInstance();

            // ---- Main Query ----
            const getUsageQuery = `
            SELECT
                ia.company_id,
                ia.id AS infra_id,
                ia.deployment_name,
                pd.id AS pod_id,
                pd.pod_name,
                DATE_TRUNC('day', wt.created_at AT TIME ZONE 'UTC') AS usage_date,
                date_trunc('minute', wt.created_at AT TIME ZONE 'UTC')
                    - ((EXTRACT(EPOCH FROM wt.created_at AT TIME ZONE 'UTC')::int / 60 % ${bucketMinutes}) * INTERVAL '1 minute') AS usage_time,
                ROUND(SUM(wt.amount), 4) AS total_amount,
                COUNT(*) AS txn_count,
                (${bucketMinutes}) AS active_minutes
            FROM price_schema.wallet_transactions wt
            JOIN infra_schema.pod_details pd ON pd.id::varchar = wt.reference_id
            JOIN infra_schema.infra_allocation ia ON pd.infra_allocation_id = ia.id
            WHERE wt.reference_type = 'DEPLOYMENT'
            AND wt.is_delete = 0
            AND ia.is_delete = 0
            AND pd.is_delete = 0
            AND ia.module_id IN (${param.model_ids})
            AND (wt.created_at AT TIME ZONE 'UTC') 
            BETWEEN ('${param.start_date}')::timestamptz AND ('${param.end_date}')::timestamptz
            GROUP BY
                ia.company_id,
                ia.id,
                ia.deployment_name,
                pd.id,
                pd.pod_name,
                usage_date,
                usage_time
            ORDER BY usage_date DESC, usage_time DESC`;

            const getUsageData: any[] = await dbConnection.executeExternalQuery(getUsageQuery, []);

            // ---- Transform output like Shared Endpoint ----
            const costs: Array<{ usage_date: string; id: number; deployment_name: string; total_cost: number }> = [];
            const node_minutes: Array<{ usage_date: string; id: number; deployment_name: string; total_minutes: number }> = [];
            const modelMap = new Map<number, { id: number; deployment_name: string; total_minutes: number; total_cost: number }>();

            let totalCost = 0;
            let totalMinutes = 0;

            if (getUsageData?.length) {
                for (const row of getUsageData) {
                    console.log('----------row-------------', row);

                    let usage_date = ''
                    switch (param.timezone) {
                        case TimeZone.Asia:
                        case TimeZone.LOCAL:
                            usage_date = moment.utc(row.usage_time)
                                .utcOffset(330)
                                .format('YYYY-MM-DD HH:mm:ss');
                            break;
                        default:
                            usage_date = moment.utc(row.usage_time).format('YYYY-MM-DD HH:mm:ss');
                            break;
                    }
                    const id = Number(row.infra_id);
                    const deployment_name = row.deployment_name;
                    const total_minutes = Number(row.active_minutes);
                    const total_cost = Number(row.total_amount);
                    costs.push({ usage_date, id, deployment_name, total_cost });
                    node_minutes.push({ usage_date, id, deployment_name, total_minutes });
                    totalCost += total_cost;
                    totalMinutes += total_minutes;
                    const existing = modelMap.get(id);
                    if (existing) {
                        existing.total_minutes += total_minutes;
                        existing.total_cost += total_cost;
                        existing.total_cost = Number(existing.total_cost.toFixed(5));
                    } else {
                        modelMap.set(id, { id, deployment_name, total_minutes, total_cost });
                    }
                }
            }

            const models = Array.from(modelMap.values());
            totalCost = Number(totalCost.toFixed(5));

            const record = {
                costs,
                node_minutes,
                models,
                totalCost,
                totalMinutes,
            };

            return Promise.resolve(record);
        } catch (error) {
            console.log('------PrivateEndPointDashboardService prepareQuery---', error);
            return Promise.reject(error);
        }
    }

}

export default PrivateEndPointDashboardService;