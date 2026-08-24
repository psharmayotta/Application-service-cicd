import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { WalletEntity } from "../../entities/walletEntity";
import { WalletModel } from "../../database/repository/wallet/wallet.model";
import { WalletDto } from "../../database/repository/wallet/wallet.dto";
import { Pagination, WalletFilter } from "../../core/InferParams";
import {
    COST_FORECAST_API_TIMEOUT_MS,
    COST_FORECAST_API_URL,
    WalletStatus,
    WalletTxnReferenceType,
} from "../../config";
import { WalletTransactionEntity } from "../../entities/walletTransactionsEntity";
import { InfraAllocationEntity } from "../../entities/infraAllocationEntity";
import { PodDetailsEntity } from "../../entities/podDetails";
import { ModelEntity } from "../../entities/modelEntity";
import { ChatEntity } from "../../entities/chatEntity";
import { ChatSessionEntity } from "../../entities/chatSessionEntity";
import { ModelProviderEntity } from "../../entities/modelProviderEntity";
import Database from "../../database/database";
import { ModelTrainingEntity } from "../../entities/modelTrainingEntity";
import { BenchmarkingEntity } from "../../entities/benchmarkingEntity";
import { BatchInferenceEntity } from "../../entities/batchInferenceEntity";
import { BatchInferenceJobEntity } from "../../entities/batchInferenceJobEntity";
import { KnowledgeBaseEntity } from "../../entities/knowledgeBaseEntity";
import { DataSetEntity } from "../../entities/dataSetEntity";
import BudgetControlService from "../budgetControl/budgetControlService.services";
import axios, { AxiosInstance } from "axios";
import { CompanyMemberRolesEntity } from "../../entities/companyMemberRolesEntity";

interface CostForecastParams {
    company_id: number;
    member_id: number;
    months?: number;
}

const COST_FORECAST_GROWTH_FACTOR = 0.05;

class WalletService extends BaseServices {
    constructor(
        entity: any = WalletEntity,
        protected awsService: AwsService = new AwsService(),
        private forecastClient: Pick<AxiosInstance, 'get'> = axios,
        private forecastApiUrl: string = COST_FORECAST_API_URL
    ) {
        super(entity, awsService);
    }

    getModel(): WalletModel {
        return new WalletModel();
    }

    getDTO() {
        return WalletDto;
    }

    async getCostForecast(param: CostForecastParams): Promise<any> {
        const companyId = Number(param.company_id);
        const memberId = Number(param.member_id);

        if (!Number.isSafeInteger(companyId) || companyId < 1) {
            return Promise.reject('E10020');
        }
        if (!Number.isSafeInteger(memberId) || memberId < 1) {
            return Promise.reject('E10047');
        }
        if (
            param.months !== undefined
            && (!Number.isSafeInteger(param.months) || param.months < 1 || param.months > 12)
        ) {
            return Promise.reject('E10004');
        }
        const membership = await CompanyMemberRolesEntity.findOneBy({
            company_id: companyId,
            member_id: memberId,
            active: true,
            is_access_active: true,
            is_delete: 0,
        });
        if (!membership) {
            return Promise.reject('E10003');
        }

        const wallet = await this.entity.findOne({
            select: ['id'],
            where: { company_id: companyId, is_delete: 0 },
            order: { id: 'DESC' },
        });
        if (!wallet) {
            return Promise.reject('E10074');
        }

        const query: Record<string, number> = {
            wallet_id: Number(wallet.id),
            growth_factor: COST_FORECAST_GROWTH_FACTOR,
        };
        if (param.months !== undefined) {
            query.months = param.months;
        }

        try {
            const response = await this.forecastClient.get(
                `${this.forecastApiUrl.replace(/\/+$/, '')}/forecast`,
                {
                    params: query,
                    timeout: COST_FORECAST_API_TIMEOUT_MS,
                }
            );
            return response.data;
        } catch (error: any) {
            const upstreamStatus = axios.isAxiosError(error) ? error.response?.status : undefined;
            console.error('Cost forecast API request failed', {
                status: upstreamStatus,
                code: axios.isAxiosError(error) ? error.code : undefined,
            });

            if (upstreamStatus === 404) {
                return Promise.reject('E10075');
            }
            if (upstreamStatus === 422) {
                return Promise.reject('E10004');
            }
            return Promise.reject('E10076');
        }
    }

    async prepareQuery(param: Pagination): Promise<any> {
        try {
            const companyId = (param as any).company_id;
            const balanceData = await this.entity.findOne({ where: { company_id: (param as any).company_id, is_delete: 0, status: WalletStatus.ACTIVE } });

            if (balanceData) {
                const balanceObj: any = { ...balanceData };
                let isSuspended = false;
                if (companyId) {
                    const activeAlerts = await BudgetControlService.getActiveBudgetAlerts(companyId).catch((err) => {
                        console.error('Error fetching active budget alerts:', err);
                        return [];
                    });
                    balanceObj.active_budget_alerts = activeAlerts || [];
                    isSuspended = await BudgetControlService.checkIsSuspended(companyId).catch(() => false);
                } else {
                    balanceObj.active_budget_alerts = [];
                }
                balanceObj.is_suspended = isSuspended;
                return Promise.resolve(balanceObj);
            }

            return Promise.resolve(balanceData);
        } catch (error) {
            console.log('------WalletService.prepareQuery------', error);
            return Promise.reject(error);
        }
    }

    async prepareQueryById(param: WalletFilter): Promise<any> {
        try {
            if (!param.wallet_id) return Promise.reject('E10046');

            const qb = this.entity
                .createQueryBuilder('w')
                .select([
                    "MIN(wt.id) AS id",
                    "MAX(wt.created_at) AS created_at",
                    "MIN(wt.id) AS wallet_transaction_id",
                    "SUM(wt.amount) AS transaction_amount",
                    "CASE WHEN MIN(wt.reference_type::text) = 'DATASET' THEN MAX(wt.modified_at) WHEN UPPER(MIN(wt.reference_type::text)) IN ('PAYMENT', 'BENCHMARKING', 'BATCH_INFERENCE', 'KNOWLEDGEBASE') THEN MIN(wt.modified_at) ELSE MIN(date_trunc('day', wt.modified_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')) END AS transaction_date",
                    "MIN(w.company_id) AS company_id",
                    "MIN(w.balance) AS balance",
                    "MIN(wt.type) AS type",
                    "MIN(wt.reference_type) AS reference_type",
                    "MIN(wt.reference_id) AS reference_id",
                    "MIN(wt.status) AS status",
                    "MIN(wt.remarks) AS remarks",
                    "CASE WHEN MIN(wt.reference_type::text) = 'PAYMENT' THEN COALESCE((SELECT wo.sof_number FROM price_schema.web_orders wo WHERE wo.payment_order_id = MIN(wt.reference_id) AND wo.is_delete = 0 LIMIT 1), CONCAT('OD', MIN(wt.id))) ELSE CONCAT('OD', MIN(wt.id)) END AS order_id",
                    "m.name AS model_name",
                    "m.id AS model_id",
                    "mp.model_provider_icon AS model_provider_icon",
                    "mp.id AS model_provider_id"
                ])
                .addSelect(`
                MIN(
                    CASE 
                    WHEN UPPER(wt.reference_type::text) = 'PLAYGROUND' THEN m.name
                    WHEN UPPER(wt.reference_type::text) = 'DEPLOYMENT' THEN ia.deployment_name
                    WHEN UPPER(wt.reference_type::text) = 'TRAINING' THEN mt.name
                    WHEN UPPER(wt.reference_type::text) = 'MYMODEL' THEN m.name
                    WHEN UPPER(wt.reference_type::text) = 'BENCHMARKING' THEN be.name
                    WHEN UPPER(wt.reference_type::text) = 'BATCH_INFERENCE' THEN bi.name
                    WHEN UPPER(wt.reference_type::text) = 'KNOWLEDGEBASE' THEN kb.name
                    WHEN UPPER(wt.reference_type::text) = 'DATASET' THEN ds.name
                    WHEN UPPER(wt.reference_type::text) = 'SIGNUP_BONUS' THEN 'Signup Bonus'
                    END
                )
                `, 'reference_name')

                .innerJoin(WalletTransactionEntity, 'wt', 'w.id = wt.wallet_id')

                .leftJoin(PodDetailsEntity, 'p',
                    `CAST(p.id AS VARCHAR) = wt.reference_id 
                 AND UPPER(wt.reference_type::text) = 'DEPLOYMENT'`
                )
                .leftJoin(InfraAllocationEntity, 'ia', 'ia.id = p.infra_allocation_id')

                .leftJoin(ChatEntity, 'c',
                    `wt.reference_id = CAST(c.id AS VARCHAR) 
                 AND UPPER(wt.reference_type::text) = 'PLAYGROUND'`
                )
                .leftJoin(ChatSessionEntity, 'cs', 'cs.id = c.chat_session_id')
                .leftJoin(ModelTrainingEntity, 'mt', `wt.reference_id = CAST(mt.id AS VARCHAR) AND UPPER(wt.reference_type::text) = 'TRAINING'`)
                .leftJoin(BenchmarkingEntity, 'be', `wt.reference_id = CAST(be.id AS VARCHAR) AND UPPER(wt.reference_type::text) = 'BENCHMARKING'`)
                .leftJoin(BatchInferenceJobEntity, 'bij', `wt.reference_id = CAST(bij.id AS VARCHAR) AND UPPER(wt.reference_type::text) = 'BATCH_INFERENCE'`)
                .leftJoin(BatchInferenceEntity, 'bi', 'bi.id = bij.inference_id')
                .leftJoin(KnowledgeBaseEntity, 'kb', `wt.reference_id = CAST(kb.id AS VARCHAR) AND UPPER(wt.reference_type::text) = 'KNOWLEDGEBASE'`)
                .leftJoin(DataSetEntity, 'ds', `wt.reference_id = CAST(ds.id AS VARCHAR) AND UPPER(wt.reference_type::text) = 'DATASET'`)
                .leftJoin(ModelEntity, 'm', `m.id = COALESCE(cs.model_id, mt.model_id, CASE WHEN UPPER(wt.reference_type::text) = 'MYMODEL' THEN CAST(wt.reference_id AS INTEGER) ELSE NULL END)`)
                .leftJoin(ModelProviderEntity, 'mp', 
                    `mp.id = CASE 
                        WHEN UPPER(wt.reference_type::text) = 'MYMODEL' AND m.model_class_id IS NOT NULL THEN 
                            (SELECT bm.model_provider_id FROM model.model bm 
                             WHERE bm.model_class_id = m.model_class_id AND bm.is_delete = 0 AND bm.model_provider_id IS NOT NULL 
                             ORDER BY bm.id ASC LIMIT 1)
                        ELSE m.model_provider_id 
                    END`
                )

                .where('w.id = :walletId', { walletId: param.wallet_id })
                .andWhere('w.is_delete = 0')
                .andWhere('wt.is_delete = 0');

            if (param.start_date) {
                qb.andWhere("DATE(wt.modified_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') >= :startDate", { startDate: param.start_date });
            }

            if (param.end_date) {
                qb.andWhere("DATE(wt.modified_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') <= :endDate", { endDate: param.end_date });
            }

            if (param.reference_type) {
                qb.andWhere('UPPER(wt.reference_type::text) = :referenceType', { referenceType: param.reference_type.toUpperCase() });
            }

            qb.groupBy("date_trunc('day', wt.modified_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')")
                .addGroupBy('m.id')
                .addGroupBy('m.name')
                .addGroupBy('mp.id')
                .addGroupBy('mp.model_provider_icon')
                .addGroupBy('ia.deployment_name')
                .addGroupBy('mt.name')
                .addGroupBy('be.name')
                .addGroupBy('bi.name')
                .addGroupBy('kb.name')
                .addGroupBy('ds.name')

                .addGroupBy("CASE WHEN UPPER(wt.reference_type::text) IN ('PAYMENT', 'BENCHMARKING', 'BATCH_INFERENCE', 'KNOWLEDGEBASE') THEN wt.id ELSE NULL END")

                .orderBy('MAX(wt.created_at)', 'DESC');

            const result = await qb.getRawMany();

            const finalResult = await Promise.all(
                result.map(async (item) => {
                    if (item.model_provider_icon && !item.model_provider_icon.startsWith('http')) {
                        try {
                            item.model_provider_icon = await this.generateSignedUrl(
                                'modelProviderMedia',
                                item.model_provider_id,
                                item.model_provider_icon
                            );
                        } catch (error) {
                            console.error("Error generating signed URL for model provider icon", error);
                            item.model_provider_icon = null;
                        }
                    }
                    return item;
                })
            );

            return Promise.resolve(finalResult);

        } catch (error) {
            console.log('----------walletService.prepareQueryById--------', error);
            return Promise.reject(error);
        }
    }


    // async prepareQueryById(param: WalletFilter): Promise<any> {
    //     try {
    //         if (!param.wallet_id) return Promise.reject('E10046');

    //         const qb = this.entity
    //             .createQueryBuilder('w')
    //             .select([
    //                 'w.id AS id',
    //                 'w.company_id AS company_id',
    //                 'w.balance AS balance',
    //                 'wt.id AS wallet_transaction_id',
    //                 'wt.type AS type',
    //                 'wt.amount AS transaction_amount',
    //                 'wt.modified_at AS transaction_date',
    //                 'wt.reference_type AS reference_type',
    //                 'wt.reference_id AS reference_id',
    //                 'wt.status AS status',
    //                 'wt.remarks AS remarks',
    //                 "CONCAT('OD', wt.id) AS order_id",
    //             ])
    //             .addSelect(`
    //     CASE 
    //       WHEN UPPER(wt.reference_type::text) = 'PLAYGROUND' THEN m.name
    //       WHEN UPPER(wt.reference_type::text) = 'DEPLOYMENT' THEN ia.deployment_name
    //     END
    //   `, 'reference_name')
    //             .innerJoin(WalletTransactionEntity, 'wt', 'w.id = wt.wallet_id')
    //             .leftJoin(
    //                 PodDetailsEntity,
    //                 'p',
    //                 `CAST(p.id AS VARCHAR) = wt.reference_id 
    //      AND UPPER(wt.reference_type::text) = 'DEPLOYMENT'`
    //             )
    //             .leftJoin(
    //                 InfraAllocationEntity,
    //                 'ia',
    //                 'ia.id = p.infra_allocation_id'
    //             )
    //             .leftJoin(
    //                 ChatEntity,
    //                 'c',
    //                 `wt.reference_id = CAST(c.id AS VARCHAR) 
    //      AND UPPER(wt.reference_type::text) = 'PLAYGROUND'`
    //             )
    //             .leftJoin(ChatSessionEntity, 'cs', 'cs.id = c.chat_session_id')
    //             .leftJoin(ModelEntity, 'm', 'm.id = cs.model_id')
    //             .leftJoin(ModelProviderEntity, 'mp', 'mp.id = m.model_provider_id')
    //             .addSelect([
    //                 'm.name AS model_name',
    //                 'm.id AS model_id',
    //             ])
    //             .addSelect([
    //                 'mp.model_provider_icon AS model_provider_icon',
    //                 'mp.id AS model_provider_id',
    //             ])
    //             .where('w.id = :walletId', { walletId: param.wallet_id })
    //             .andWhere('w.is_delete = 0')
    //             .andWhere('wt.is_delete = 0')
    //             .orderBy('wt.modified_at', 'DESC');

    //         const result = await qb.getRawMany();

    //         const finalResult = await Promise.all(
    //             result.map(async (item) => {
    //                 if (item.model_provider_icon && !item.model_provider_icon.startsWith('http')) {
    //                     try {
    //                         item.model_provider_icon = await this.generateSignedUrl(
    //                             'modelProviderMedia',
    //                             item.model_provider_id,
    //                             item.model_provider_icon
    //                         );
    //                     } catch (error) {
    //                         console.error("Error generating signed URL for model provider icon", error);
    //                         item.model_provider_icon = null;
    //                     }
    //                 }
    //                 return item;
    //             })
    //         );

    //         return Promise.resolve(finalResult);
    //     } catch (error) {
    //         console.log('----------walletService.prepareQueryById--------', error);
    //         return Promise.reject(error);
    //     }
    // }

    async walletUsage(param: any): Promise<any> {
        try {
            if (!param.company_id) return Promise.reject('E10020');
            if (!param.model_id && param.reference_type !== 'DATASET') return Promise.reject('E10022');

            let startDate = param.start_date;
            let endDate = param.end_date;

            if (!startDate || !endDate) {
                const now = new Date();
                const year = now.getFullYear();
                const month = now.getMonth();
                const firstDay = new Date(Date.UTC(year, month, 1));
                const lastDay = new Date(Date.UTC(year, month + 1, 0));

                startDate = firstDay.toISOString().split('T')[0];
                endDate = lastDay.toISOString().split('T')[0];
            }

            const dbConnection = Database.getInstance();

            // DATASET: group by hour and return cumulative summed amounts per hourly window
            if (param.reference_type === 'DATASET') {
                const datasetSql = `
                    SELECT 
                        usage_hour,
                        request_id,
                        total_transactions,
                        total_amount,
                        SUM(total_amount) OVER (ORDER BY usage_hour ASC) AS cumulative_amount,
                        latest_transaction_time,
                        datasets
                    FROM (
                        SELECT 
                            date_trunc('hour', wt.created_at) AS usage_hour,
                            'OD' || TO_CHAR(date_trunc('hour', wt.created_at), 'YYYYMMDDHH24') AS request_id,
                            COUNT(wt.id) AS total_transactions,
                            CAST(ROUND(COALESCE(SUM(wt.amount), 0)::numeric, 8) AS numeric) AS total_amount,
                            MAX(wt.created_at) AS latest_transaction_time,
                            json_agg(json_build_object('id', ds.id, 'name', ds.name, 'amount', wt.amount) ORDER BY ds.name) AS datasets
                        FROM price_schema.wallet_transactions wt
                        JOIN price_schema.wallet w ON wt.wallet_id = w.id
                        LEFT JOIN model.data_sets ds ON wt.reference_id = CAST(ds.id AS VARCHAR)
                        WHERE w.company_id = ${param.company_id}
                        AND wt.reference_type = 'DATASET'
                        AND wt.is_delete = 0
                        AND (wt.created_at AT TIME ZONE 'UTC') BETWEEN 
                            (TIMESTAMP '${startDate}' AT TIME ZONE 'Asia/Kolkata')
                            AND (TIMESTAMP '${endDate}' AT TIME ZONE 'Asia/Kolkata')
                        GROUP BY date_trunc('hour', wt.created_at)
                    ) sub
                    ORDER BY usage_hour DESC
                `;

                const results = await dbConnection.executeExternalQuery(datasetSql);

                return {
                    data: results,
                    total_records: results.length,
                    reference_type: 'DATASET'
                };
            }

            // Original logic for non-DATASET reference types
            let referenceTypeFilter = '';
            if (param.reference_type) {
                referenceTypeFilter = `AND wt.reference_type = '${param.reference_type}'`;
            }

            const modelId = param.model_id;

            const sql = `
                SELECT 
                    wt.id,
                    wt.amount,
                    wt.reference_type,
                    wt.created_at,
                    CASE 
                        WHEN wt.reference_type = 'PLAYGROUND' THEN c.input_word_count 
                        ELSE NULL 
                    END as input_tokens,
                    CASE 
                        WHEN wt.reference_type = 'PLAYGROUND' THEN c.output_word_count 
                        ELSE NULL 
                    END as output_tokens
                FROM price_schema.wallet_transactions wt
                LEFT JOIN price_schema.wallet w ON wt.wallet_id = w.id
                
                -- Joins to filter by model_id and get tokens
                LEFT JOIN chat_schema.chat c ON wt.reference_id = CAST(c.id AS VARCHAR) AND wt.reference_type = 'PLAYGROUND'
                LEFT JOIN chat_schema.chat_session cs ON c.chat_session_id = cs.id
                
                LEFT JOIN infra_schema.pod_details pd ON wt.reference_id = CAST(pd.id AS VARCHAR) AND wt.reference_type = 'DEPLOYMENT'
                LEFT JOIN infra_schema.infra_allocation ia ON pd.infra_allocation_id = ia.id
                
                LEFT JOIN model.model_training mt ON wt.reference_id = CAST(mt.id AS VARCHAR) AND wt.reference_type = 'TRAINING'
                LEFT JOIN model.model m ON wt.reference_id = CAST(m.id AS VARCHAR) AND wt.reference_type = 'MYMODEL'
                
                WHERE w.company_id = ${param.company_id}
                AND (wt.created_at AT TIME ZONE 'UTC') BETWEEN 
                    (TIMESTAMP '${startDate}' AT TIME ZONE 'Asia/Kolkata')
                    AND (TIMESTAMP '${endDate}' AT TIME ZONE 'Asia/Kolkata')
                ${referenceTypeFilter}
                AND (
                    (wt.reference_type = 'PLAYGROUND' AND cs.model_id = ${modelId}) OR
                    (wt.reference_type = 'DEPLOYMENT' AND ia.module_type = 'model' AND ia.module_id = ${modelId}) OR 
                    (wt.reference_type = 'DEPLOYMENT' AND ia.module_type = 'training' AND ia.module_id = ${modelId}) OR
                    (wt.reference_type = 'TRAINING' AND mt.model_id = ${modelId}) OR 
                    (wt.reference_type = 'MYMODEL' AND m.id = ${modelId}) 
                )
                ORDER BY wt.created_at DESC
            `;

            const results = await dbConnection.executeExternalQuery(sql);

            return {
                data: results,
                total_records: results.length
            };

        } catch (error) {
            console.error("WalletTransactionService prepareQuery error:", error);
            throw error;
        }
    }

}

export default WalletService;
