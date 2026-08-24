import { BaseServices } from "../baseService.services";
import { AwsService } from "../../core/AwsService";
import { ChatSessionEntity } from "../../entities/chatSessionEntity";
import { UsagePresetFilter } from "../../config";
import { ChatFilter } from "../../core/InferParams";
import Database from "../../database/database";

class BillingUsageService extends BaseServices {
    constructor(entity: any = ChatSessionEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): any {
        return {};
    }

    getDTO(): any {
        return {};
    }

    override async prepareQuery(param: ChatFilter): Promise<any> {
        try {
            if (param.company_id === undefined || param.company_id === null || typeof param.company_id !== 'number') {
                return Promise.reject(`E10020`);
            }

            if (!param.start_date || !param.end_date) {
                return Promise.reject(`E10021`);
            }

            const dbConnection = Database.getInstance();

            const getUsageQuery = `
                SELECT
                    --MIN(c.created_at) AS usage_date,
                    c.created_at as usage_date,
                    cs.id as session_id,
                    m.id as id,
                    m.name AS model_name,
                    mp.model_provider_icon AS model_icon,
                    mp.id AS model_provider_id,
                    COUNT(c.id) AS total_requests,
                    CAST(ROUND(COALESCE(SUM(wt.amount), 0), 5) AS numeric(12,5)) AS total_cost,
                    COUNT(c.id) AS success_count,
                    0 AS error_count,

                    SUM(c.input_word_count) AS total_prompt_tokens,
                    SUM(c.output_word_count) AS total_completion_tokens,

                    ROUND((SUM(c.output_word_count) / NULLIF(SUM(c.inference_time) / 1000.0, 0))::numeric, 5) AS generated_tokens_per_second,
                    ROUND((COUNT(c.id) / NULLIF(SUM(c.inference_time) / 1000.0, 0))::numeric, 5) AS requests_per_second,
                    ROUND((SUM(c.input_word_count) / NULLIF(SUM(c.inference_time) / 1000.0, 0))::numeric, 5) AS prompt_tokens_per_second,

                    SUM(c.inference_time) / 1000.0 AS total_duration_seconds

                FROM chat_schema.chat_session cs
                JOIN chat_schema.chat c ON c.chat_session_id = cs.id AND c.is_delete = 0
                JOIN model.model m ON m.id = cs.model_id AND m.is_delete = 0
                JOIN model.model_provider mp ON mp.id = m.model_provider_id AND mp.is_delete = 0
                JOIN price_schema.wallet_transactions wt 
                    ON wt.reference_id = c.id::text AND wt.is_delete = 0 AND wt.reference_type = 'PLAYGROUND'


                WHERE cs.company_id = ${param.company_id}
                AND c.created_at BETWEEN 
                    (TIMESTAMP '${param.start_date}' AT TIME ZONE 'Asia/Kolkata')
                    AND (TIMESTAMP '${param.end_date}' AT TIME ZONE 'Asia/Kolkata')
                AND wt.status = 'SUCCESS'

                GROUP BY m.id, mp.id, m.name, mp.model_provider_icon, usage_date, cs.id
                ORDER BY usage_date DESC
                `;

            const getUsageData: any[] = await dbConnection.executeExternalQuery(getUsageQuery, []);

            const costs: any[] = [];
            const requests: any[] = [];

            const responseStatus: any[] = [];
            const requestPerSecond: any[] = [];
            const promptTokenPerSecond: any[] = [];
            const generatedTokenPerSecond: any[] = [];

            const modelMap = new Map<number, {
                id: number;
                model_name: string;
                model_icon: string;
                usage_date: string;
                total_requests: number;
                total_cost: number;
                total_prompt_tokens: number;
                total_completion_tokens: number;
            }>();

            let totalCost = 0;
            let totalRequest = 0;
            let totalSuccessRequest = 0;
            let totalDuration = 0;
            let totalPromptTokens = 0;
            let totalCompletionTokens = 0;

            const signedUrlCache = new Map<string, string>();
            const urlPromises: Promise<any>[] = [];

            for (const row of getUsageData) {
                if (row.model_icon) {
                    const providerId = Number(row.model_provider_id || 0);
                    const key = `${providerId}_${row.model_icon}`;
                    if (!signedUrlCache.has(key)) {
                        signedUrlCache.set(key, '');
                        urlPromises.push(
                            this.generateSignedUrl('modelProviderMedia', providerId, row.model_icon)
                                .then(url => signedUrlCache.set(key, url || ''))
                        );
                    }
                }
            }
            await Promise.all(urlPromises);

            for (const row of getUsageData) {

                const usage_date = row.usage_date;
                const id = Number(row.id);
                const model_name = row.model_name;
                const providerId = Number(row.model_provider_id || 0);
                const model_icon = row.model_icon ? (signedUrlCache.get(`${providerId}_${row.model_icon}`) || '') : '';

                const total_requests = Number(row.total_requests);
                const total_cost = Number(row.total_cost);
                const total_duration = Number(row.total_duration_seconds || 0);
                const total_prompt_tokens = Number(row.total_prompt_tokens || 0);
                const total_completion_tokens = Number(row.total_completion_tokens || 0);

                costs.push({ usage_date, id, model_name, total_cost });
                requests.push({ usage_date, id, model_name, total_requests });

                responseStatus.push({
                    usage_date,
                    id,
                    model_name,
                    success: Number(row.success_count),
                    error: Number(row.error_count)
                });

                requestPerSecond.push({
                    usage_date,
                    id,
                    model_name,
                    value: Number(row.requests_per_second)
                });

                promptTokenPerSecond.push({
                    usage_date,
                    id,
                    model_name,
                    value: Number(row.prompt_tokens_per_second)
                });

                generatedTokenPerSecond.push({
                    usage_date,
                    id,
                    model_name,
                    value: Number(row.generated_tokens_per_second)
                });

                totalCost += total_cost;
                totalRequest += total_requests;
                totalSuccessRequest += Number(row.success_count);
                totalDuration += total_duration;
                totalPromptTokens += total_prompt_tokens;
                totalCompletionTokens += total_completion_tokens;

                const existing = modelMap.get(id);
                if (existing) {
                    existing.total_requests += total_requests;
                    existing.total_cost += total_cost;
                    existing.total_prompt_tokens += total_prompt_tokens;
                    existing.total_completion_tokens += total_completion_tokens;

                    existing.total_cost = Number(existing.total_cost.toFixed(5));

                    // Keep the earliest created_at if multiple rows exist for the same model
                    if (new Date(row.usage_date) < new Date(existing.usage_date)) {
                        existing.usage_date = row.usage_date;
                    }
                } else {
                    modelMap.set(id, {
                        id,
                        model_name,
                        model_icon,
                        usage_date: row.usage_date,
                        total_requests,
                        total_cost,
                        total_prompt_tokens,
                        total_completion_tokens
                    });
                }
            }

            const models = Array.from(modelMap.values());

            totalCost = Number(totalCost.toFixed(5));
            // const request_per_minute = totalDuration > 0 ? Number(((totalRequest / totalDuration) * 60).toFixed(5)) : 0;
            // const input_token_per_minute = totalDuration > 0 ? Number(((totalPromptTokens / totalDuration) * 60).toFixed(5)) : 0;
            // const output_token_per_minute = totalDuration > 0 ? Number(((totalCompletionTokens / totalDuration) * 60).toFixed(5)) : 0;

            const request_per_minute = totalDuration > 0 ? Number((totalRequest / totalDuration).toFixed(5)) : 0;
            const success_request_per_second = totalDuration > 0 ? Number((totalSuccessRequest / totalDuration).toFixed(5)) : 0;
            const input_token_per_minute = totalDuration > 0 ? Number((totalPromptTokens / totalDuration).toFixed(5)) : 0;
            const output_token_per_minute = totalDuration > 0 ? Number((totalCompletionTokens / totalDuration).toFixed(5)) : 0;

            return {
                costs,
                requests,
                responseStatus,
                requestPerSecond,
                promptTokenPerSecond,
                generatedTokenPerSecond,
                models,
                totalCost,
                totalRequest,
                request_per_minute,
                success_request_per_second,
                input_token_per_minute,
                output_token_per_minute
            };

        } catch (error) {
            console.log('------UsageService prepareQuery---', error);
            return Promise.reject(error);
        }
    }

}

export default BillingUsageService;
