import { AwsService } from "../../core/AwsService";
import { SecurityDto } from "../../database/repository/security/securityDto.dto";
import { InferModel } from "../../database/repository/InferModel/InferModel.model";
import { BaseServices } from "../baseService.services";
import { ChatSessionEntity } from "../../entities/chatSessionEntity";
import { ChatFilter, Pagination } from "../../core/InferParams";
import Database from "../../database/database";
import CryptoJS from "crypto-js";
import { UsagePresetFilter } from "../../config";
import { toUTC } from "../../utils/dateFormatter/dateFormatter";

class UsageService extends BaseServices {
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
            if (param.company_id === undefined || param.company_id === null || typeof param.company_id !== 'number') {
                return Promise.reject(`E10020`);
            }

            if (!param.start_date || !param.end_date) {
                return Promise.reject(`E10021`);
            }

            if (!param.model_ids || param.model_ids.length <= 0) {
                return Promise.reject(`E10022`);
            }

            // if (!param.preset_filter) Promise.reject('E10041')

            let groupingExpr = '';
            const isLocalTimezone = param.timezone === 'Local (Browser timezone)';

            switch (param.preset_filter) {
                case UsagePresetFilter.LAST_30_MIN:
                    // 1-minute buckets
                    groupingExpr = isLocalTimezone
                        ? `date_trunc('hour', c.created_at)
               + floor(date_part('minute', c.created_at) / 1) * interval '1 minutes'`
                        : `date_trunc('hour', c.created_at AT TIME ZONE '${param.timezone}')
               + floor(date_part('minute', c.created_at AT TIME ZONE '${param.timezone}') / 1) * interval '1 minutes'`;
                    break;

                case UsagePresetFilter.LAST_2_HOUR:
                    // 15-minute buckets
                    groupingExpr = isLocalTimezone
                        ? `date_trunc('hour', c.created_at)
               + floor(date_part('minute', c.created_at) / 15) * interval '15 minutes'`
                        : `date_trunc('hour', c.created_at AT TIME ZONE '${param.timezone}')
               + floor(date_part('minute', c.created_at AT TIME ZONE '${param.timezone}') / 15) * interval '15 minutes'`;
                    break;

                case UsagePresetFilter.LAST_12_HOUR:
                    // 30-minute buckets
                    groupingExpr = isLocalTimezone
                        ? `date_trunc('hour', c.created_at)
               + floor(date_part('minute', c.created_at) / 30) * interval '30 minutes'`
                        : `date_trunc('hour', c.created_at AT TIME ZONE '${param.timezone}')
               + floor(date_part('minute', c.created_at AT TIME ZONE '${param.timezone}') / 30) * interval '30 minutes'`;
                    break;

                case UsagePresetFilter.LAST_24_HOUR:
                    // hourly buckets
                    groupingExpr = isLocalTimezone
                        ? `date_trunc('hour', c.created_at)`
                        : `date_trunc('hour', c.created_at AT TIME ZONE '${param.timezone}')`;
                    break;

                case UsagePresetFilter.LAST_1_WEEK:
                case UsagePresetFilter.LAST_1_MONTH:
                    // daily buckets
                    groupingExpr = isLocalTimezone
                        ? `date_trunc('day', c.created_at)`
                        : `date_trunc('day', c.created_at + tz.utc_offset::interval)`;
                    break;

                case UsagePresetFilter.LAST_3_MONTH:
                case UsagePresetFilter.LAST_6_MONTH:
                case UsagePresetFilter.LAST_1_YEAR:
                    // weekly buckets
                    groupingExpr = isLocalTimezone
                        ? `date_trunc('week', c.created_at)`
                        : `date_trunc('week', c.created_at + tz.utc_offset::interval)`;
                    break;

                default:
                    groupingExpr = isLocalTimezone
                        ? `date_trunc('day', c.created_at)`
                        : `date_trunc('day', c.created_at + tz.utc_offset::interval)`;
                    break;
            }

            const dbConnection = Database.getInstance();

            const getUsageQuery = `
            SELECT
               ${isLocalTimezone ? groupingExpr.replace(/\+ tz\.utc_offset::interval/g, '') : groupingExpr} AS usage_date,
                m.id as id,
                m.name AS model_name,
                mp.model_provider_icon AS model_icon,
                mp.id AS model_provider_id,
                COUNT(c.id) AS total_requests,
                CAST(ROUND(COALESCE(SUM(wt.amount), 0), 5) AS numeric(12,5)) AS total_cost
            FROM chat_schema.chat_session cs
            JOIN chat_schema.chat c ON c.chat_session_id = cs.id AND c.is_delete = 0
            JOIN model.model m ON m.id = cs.model_id AND m.is_delete = 0
            JOIN model.model_provider mp ON mp.id = m.model_provider_id and mp.is_delete = 0
            JOIN price_schema.wallet_transactions wt ON wt.reference_id = c.id::text AND wt.is_delete = 0 AND wt.reference_type = 'PLAYGROUND'
            ${isLocalTimezone ? '' : `JOIN v0_dev_yotta.timezone tz ON tz.name = '${param.timezone}'`}
            WHERE cs.company_id = ${param.company_id} AND cs.model_id IN (${param.model_ids})
             AND c.created_at BETWEEN ${isLocalTimezone
                    ? `TIMESTAMP '${param.start_date}' AND TIMESTAMP '${param.end_date}'`
                    : `(TIMESTAMP '${param.start_date}' + tz.utc_offset::interval)
                         AND (TIMESTAMP '${param.end_date}' + tz.utc_offset::interval)`
                }
            GROUP BY usage_date, m.id,mp.id,m.name,mp.model_provider_icon
            ORDER BY usage_date ASC`;

            const getUsageData: any[] = await dbConnection.executeExternalQuery(getUsageQuery, []);

            // Separate arrays
            const costs: Array<{
                usage_date: string;
                id: number;
                model_name: string;
                total_cost: number;
            }> = [];

            const requests: Array<{
                usage_date: string;
                id: number;
                model_name: string;
                total_requests: number;
            }> = [];

            // Map for aggregated totals per model
            const modelMap = new Map<
                number,
                { id: number; model_name: string; model_icon: string, total_requests: number; total_cost: number }
            >();

            let totalCost = 0;
            let totalRequest = 0;

            if (getUsageData?.length) {
                for (const row of getUsageData) {
                    const usage_date = row.usage_date;
                    const id = Number(row.id);
                    const model_provider_id = Number(row.model_provider_id)
                    const model_name = row.model_name;
                    const model_icon = row.model_icon
                        ? await this.generateSignedUrl('modelProviderMedia', model_provider_id, row.model_icon)
                        : ''
                    const total_requests = Number(row.total_requests);
                    const total_cost = Number(row.total_cost);

                    costs.push({ usage_date, id, model_name, total_cost });
                    requests.push({ usage_date, id, model_name, total_requests });

                    totalCost += total_cost;
                    totalRequest += total_requests;

                    const existing = modelMap.get(id);
                    if (existing) {
                        existing.total_requests += total_requests;
                        existing.total_cost += total_cost;
                        existing.total_cost = Number(existing.total_cost.toFixed(5));
                    } else {
                        modelMap.set(id, {
                            id,
                            model_name,
                            model_icon,
                            total_requests,
                            total_cost,
                        });
                    }
                }
            }

            const models = Array.from(modelMap.values());

            totalCost = Number(totalCost.toFixed(5));
            const record = {
                costs,
                requests,
                models,
                totalCost,
                totalRequest,
            };

            return Promise.resolve(record);
        } catch (error) {
            console.log('------UsageService prepareQuery---', error);
            return Promise.reject(error);
        }
    }

    override async prepareQueryById(param: ChatFilter): Promise<any> {
        try {
            if (!param.company_id) Promise.reject('E10020')
            if (!param.model_id) Promise.reject('E10022');
            if (!param.start_date || !param.end_date) Promise.reject(`E10021`);

            const dbConnection = Database.getInstance()
            // pagination defaults
            let offset = null
            if (param.pageNumber > 0) {
                offset = (param.pageNumber - 1) * param.pageSize;
            }

            const startDateUTC = toUTC(param.start_date)
            const endDateUTC = toUTC(param.end_date)

            console.log('-----------dates-------', startDateUTC, endDateUTC);



            // Get total count first
            const countQuery = `
            SELECT COUNT(*) AS total_count FROM (
                SELECT 1
                FROM chat_schema.chat_session cs
                JOIN chat_schema.chat c ON c.chat_session_id = cs.id AND c.is_delete = 0
                JOIN model.model m ON m.id = cs.model_id AND m.is_delete = 0
                WHERE cs.company_id = ${param.company_id} AND cs.model_id = ${param.model_id}
                AND c.created_at BETWEEN ('${startDateUTC}') AND ('${endDateUTC}')
                GROUP BY DATE_TRUNC('day', c.created_at), m.id, m.name, c.chat_session_id
            ) AS sub`;

            const countResult: any[] = await dbConnection.executeExternalQuery(countQuery, []);
            const totalRecords = Number(countResult[0]?.total_count || 0);

            let getUsageAlongModelQuery = `
            SELECT
                DATE_TRUNC('day', c.created_at) AS usage_date,
                m.id AS id,
                m.name AS model_name,
                mp.model_provider_icon AS model_image,
                mp.id AS model_provider_id,
                c.chat_session_id AS chat_session_id,
                c.input_word_count AS input_word_count,
                c.output_word_count AS output_word_count,
                c.created_at AS chat_timestamp,
                COUNT(c.id) AS total_requests,
                ROUND(COALESCE(SUM(wt.amount), 0), 3) AS total_cost
            FROM chat_schema.chat_session cs
            JOIN chat_schema.chat c ON c.chat_session_id = cs.id AND c.is_delete = 0
            JOIN model.model m ON m.id = cs.model_id AND m.is_delete = 0
            JOIN model.model_provider mp ON mp.id = m.model_provider_id and mp.is_delete = 0
            JOIN price_schema.wallet_transactions wt ON wt.reference_id = c.id::text AND wt.is_delete = 0 AND wt.reference_type = 'PLAYGROUND'
            WHERE cs.company_id = ${param.company_id} AND cs.model_id = ${param.model_id}
            AND c.created_at BETWEEN ('${startDateUTC}') AND ('${endDateUTC}')
            GROUP BY usage_date, m.id,mp.id,m.name,mp.model_provider_icon,c.chat_session_id,c.input_word_count,c.output_word_count, c.created_at
            ORDER BY usage_date DESC`;

            if (offset !== null) {
                getUsageAlongModelQuery += ` LIMIT ${param.pageSize} OFFSET ${offset}`
            }

            const getUsageAlongModelData: any[] = await dbConnection.executeExternalQuery(getUsageAlongModelQuery, []);
            let record: any = null;

            if (getUsageAlongModelData.length > 0) {
                const { id, model_name, model_image, model_provider_id } = getUsageAlongModelData[0];
                const hashId = CryptoJS.MD5(id).toString()
                const signedUrl_model_image = model_image ?
                    await this.generateSignedUrl('modelProviderMedia', model_provider_id, model_image)
                    : '';

                const token_details = getUsageAlongModelData.map(r => ({
                    input_word_count: Number(r.input_word_count),
                    output_word_count: Number(r.output_word_count),
                    chat_timestamp: r.chat_timestamp,
                }));

                const usage_details = getUsageAlongModelData.map(r => ({
                    usage_date: r.usage_date,
                    chat_session_id: r.chat_session_id,
                    totalRequest: Number(r.total_requests),
                    totalCost: Number(r.total_cost),
                    ...(r.output_word_count !== 0) && {
                        input_word_count: Number(r.input_word_count),
                        output_word_count: Number(r.output_word_count),
                        chat_timestamp: r.chat_timestamp,
                    }
                }));

                const hasTokenDetails = usage_details.some(u => u.output_word_count && u.output_word_count !== 0);

                record = {
                    id,
                    hashId,
                    model_name,
                    signedUrl_model_image,
                    model_image,
                    usage_details,
                    ...(hasTokenDetails && { token_details }),
                    totalRecords
                };
            }

            return Promise.resolve(record);
        } catch (error) {
            console.log('---UsageService.prepareQueryById----', error);
            return Promise.reject(error)
        }
    }

}

export default UsageService;