import { AwsService } from "../../core/AwsService";
import Database from "../../database/database";
import { WalletTransactionEntity } from "../../entities/walletTransactionsEntity";
import { BudgetControlEntity } from "../../entities/budgetControlEntity";
import { BaseServices } from "../baseService.services";
import { BudgetPeriodType } from "../../config";

export class MonthlyBillingService extends BaseServices {
    constructor(entity: any = WalletTransactionEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): any {
        return {};
    }

    getDTO(): any {
        return {};
    }

    getModuleName(): string {
        return 'Monthly Billing';
    }

    async prepareQuery(param: any): Promise<any> {
        try {
            const companyId = param.company_id;
            const month = param.month;
            const year = param.year;

            if (!companyId) {
                return [];
            }

            const db = Database.getInstance();
            const now = new Date();
            let targetMonth = now.getMonth() + 1;
            let targetYear = now.getFullYear();

            if (month && year) {
                const safeMonth = parseInt(month, 10);
                const safeYear = parseInt(year, 10);
                if (!isNaN(safeMonth) && !isNaN(safeYear)) {
                    targetMonth = safeMonth;
                    targetYear = safeYear;
                }
            }

            const previousMonth = targetMonth === 1 ? 12 : targetMonth - 1;
            const previousMonthYear = targetMonth === 1 ? targetYear - 1 : targetYear;

            const sql = `
                SELECT 
                    (wt.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date::text as date,
                    wt.reference_type,
                    SUM(wt.amount) as amount,
                    CASE 
                        WHEN wt.reference_type = 'DATASET' THEN COUNT(DISTINCT wt.reference_id)::text
                        ELSE NULL
                    END as dataset_count
                FROM price_schema.wallet_transactions wt
                JOIN price_schema.wallet w ON wt.wallet_id = w.id
                WHERE w.company_id = $1
                AND wt.type = 'DEBIT'
                AND wt.status = 'SUCCESS'
                AND wt.is_delete = 0
                AND EXTRACT(MONTH FROM wt.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') = $2
                AND EXTRACT(YEAR FROM wt.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') = $3
                GROUP BY (wt.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date, wt.reference_type
                ORDER BY date DESC
            `;

            const results = await db.executeExternalQuery(sql, [companyId, targetMonth, targetYear]);

            const previousMonthSql = `
                SELECT COALESCE(SUM(wt.amount), 0) AS last_month_bill_amount
                FROM price_schema.wallet_transactions wt
                LEFT JOIN price_schema.wallet w ON wt.wallet_id = w.id
                WHERE w.company_id = $1
                AND wt.type = 'DEBIT'
                AND wt.status = 'SUCCESS'
                AND wt.is_delete = 0
                AND EXTRACT(MONTH FROM wt.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') = $2
                AND EXTRACT(YEAR FROM wt.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') = $3
            `;
            const previousMonthResults = await db.executeExternalQuery(previousMonthSql, [companyId, previousMonth, previousMonthYear]);
            const previousMonthRows = Array.isArray(previousMonthResults) && Array.isArray(previousMonthResults[0])
                ? previousMonthResults[0]
                : previousMonthResults;
            const lastMonthBillAmount = parseFloat(previousMonthRows?.[0]?.last_month_bill_amount) || 0;

            let rows = [];
            if (Array.isArray(results) && results.length > 0) {
                rows = (Array.isArray(results) && Array.isArray(results[0])) ? results[0] : results;
            }

            const dailyMap = new Map<string, any>();

            rows.forEach((row: any) => {
                let dateStr = "";
                if (row.date instanceof Date) {
                    const year = row.date.getFullYear();
                    const month = String(row.date.getMonth() + 1).padStart(2, '0');
                    const day = String(row.date.getDate()).padStart(2, '0');
                    dateStr = `${year}-${month}-${day}`;
                } else if (typeof row.date === 'string') {
                    dateStr = row.date.split('T')[0];
                } else {
                    const dateObj = new Date(row.date);
                    if (!isNaN(dateObj.getTime())) {
                        const year = dateObj.getFullYear();
                        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                        const day = String(dateObj.getDate()).padStart(2, '0');
                        dateStr = `${year}-${month}-${day}`;
                    } else {
                        dateStr = String(row.date).split('T')[0];
                    }
                }

                const amount = parseFloat(row.amount);
                const refType = row.reference_type ? row.reference_type.toUpperCase() : '';

                if (!dailyMap.has(dateStr)) {
                    dailyMap.set(dateStr, {
                        date: dateStr,
                        total: 0,
                        playground: { total: 0 },
                        deployment: { total: 0 },
                        training: { total: 0 },
                        mymodel: { total: 0 },
                        knowledgebase: { total: 0 },
                        batch_inference: { total: 0 },
                        benchmarking: { total: 0 },
                        dataset: { total: 0, dataset_count: 0 }
                    });
                }

                const dayEntry = dailyMap.get(dateStr);
                dayEntry.total += amount;

                if (refType === 'PLAYGROUND') {
                    dayEntry.playground.total += amount;
                } else if (refType === 'DEPLOYMENT') {
                    dayEntry.deployment.total += amount;
                } else if (refType === 'TRAINING') {
                    dayEntry.training.total += amount;
                } else if (refType === 'MYMODEL') {
                    dayEntry.mymodel.total += amount;
                } else if (refType === 'KNOWLEDGEBASE') {
                    dayEntry.knowledgebase.total += amount;
                } else if (refType === 'BATCH_INFERENCE') {
                    dayEntry.batch_inference.total += amount;
                } else if (refType === 'BENCHMARKING') {
                    dayEntry.benchmarking.total += amount;
                } else if (refType === 'DATASET') {
                    dayEntry.dataset.total += amount;
                    dayEntry.dataset.dataset_count = parseInt(row.dataset_count) || 0;
                }
            });

            const finalResult = Array.from(dailyMap.values()).map(entry => ({
                date: entry.date,
                total: parseFloat(entry.total.toFixed(2)),
                playground: {
                    total: parseFloat(entry.playground.total.toFixed(2))
                },
                deployment: {
                    total: parseFloat(entry.deployment.total.toFixed(2))
                },
                training: {
                    total: parseFloat(entry.training.total.toFixed(2))
                },
                mymodel: {
                    total: parseFloat(entry.mymodel.total.toFixed(2))
                },
                knowledgebase: {
                    total: parseFloat(entry.knowledgebase.total.toFixed(2))
                },
                batch_inference: {
                    total: parseFloat(entry.batch_inference.total.toFixed(2))
                },
                benchmarking: {
                    total: parseFloat(entry.benchmarking.total.toFixed(2))
                },
                dataset: {
                    total: parseFloat(entry.dataset.total.toFixed(2)),
                    dataset_count: entry.dataset.dataset_count
                }
            }));

            finalResult.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            const totalSpent = finalResult.reduce((acc, curr) => acc + curr.total, 0);

            // Fetch daily and monthly budgets from budget_control using TypeORM
            const budgets = await BudgetControlEntity.find({
                where: {
                    company_id: companyId,
                    is_delete: 0
                }
            });

            let daily_budget = null;
            let monthly_budget = null;
            if (budgets && budgets.length > 0) {
                for (const row of budgets) {
                    if (row.type.toLowerCase() === BudgetPeriodType.DAILY.toLowerCase()) {
                        daily_budget = parseFloat(Number(row.budget).toFixed(2));
                    } else if (row.type.toLowerCase() === BudgetPeriodType.MONTHLY.toLowerCase()) {
                        monthly_budget = parseFloat(Number(row.budget).toFixed(2));
                    }
                }
            }

            return {
                total_spent: parseFloat(totalSpent.toFixed(2)),
                last_month_bill_amount: parseFloat(lastMonthBillAmount.toFixed(2)),
                daily_budget,
                monthly_budget,
                data: finalResult
            };

        } catch (error) {
            console.error("MonthlyBillingService prepareQuery error:", error);
            throw error;
        }
    }
}
