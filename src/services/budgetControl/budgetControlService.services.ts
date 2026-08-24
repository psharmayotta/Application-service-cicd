import axios from 'axios';
import { Raw } from 'typeorm';
import { BudgetPeriodType, TERMINATE_RESOURCES, TERMINATE_RESOURCES_API_KEY, WebhookEvents } from '../../config';
import { AwsService } from '../../core/AwsService';
import Database from '../../database/database';
import { BudgetAlertHistoryModel } from '../../database/repository/budgetAlertHistory/budgetAlertHistory.model';
import { BudgetControlDto } from '../../database/repository/budgetControl/budgetControl.dto';
import { BudgetControlModel } from '../../database/repository/budgetControl/budgetControl.model';
import { BudgetAlertHistoryEntity } from '../../entities/budgetAlertHistoryEntity';
import { BudgetControlEntity } from '../../entities/budgetControlEntity';
import { CompanyEntity } from '../../entities/companyEntity';
import { WebSocketService } from '../../utils/webSocket/webSocketService';
import { BaseServices } from '../baseService.services';
import { BudgetAlertHistoryService } from '../budgetAlertHistory/budgetAlertHistoryService.services';
import WebhookService from '../webhook/webhookService.services';

class BudgetControlService extends BaseServices {
  constructor(entity: any = BudgetControlEntity, protected awsService: AwsService = new AwsService()) {
    super(entity, awsService);
  }

  getModel(): BudgetControlModel {
    return new BudgetControlModel();
  }

  getDTO() {
    return BudgetControlDto;
  }

  getModuleName(): string {
    return 'Budget Control';
  }

  override transformModel(model: any): any {
    if (model.decryptToken && model.decryptToken.member_id) {
      model.user_id = model.decryptToken.member_id;
    }
    return model;
  }

  async prepareQuery(param: any): Promise<any> {
    try {
      const companyId = parseInt(param.company_id, 10);
      if (isNaN(companyId)) {
        return [];
      }

      const db = Database.getInstance();
      let whereCondition = '';
      if (param.search_text) {
        whereCondition = `AND bc.name ILIKE '%${param.search_text}%'`;
      }
      const sql = `
        SELECT 
            bc.id,
            bc.company_id,
            bc.user_id,
            bc.name,
            bc.type,
            bc.budget,
            bc.threshold_alert_1,
            bc.threshold_alert_2,
            bc.threshold_alert_3,
            bc.auto_stop_resources,
            bc.is_custom_threshold,
            w.balance as wallet_balance,
            COALESCE(
                CASE 
                    WHEN bc.type = '${BudgetPeriodType.DAILY}' THEN (
                        SELECT SUM(wt.amount) 
                        FROM price_schema.wallet_transactions wt
                        WHERE wt.wallet_id = w.id 
                          AND wt.type = 'DEBIT' 
                          AND wt.status = 'SUCCESS' 
                          AND wt.is_delete = 0 
                          AND wt.created_at::date = CURRENT_DATE
                    )
                    WHEN bc.type = '${BudgetPeriodType.MONTHLY}' THEN (
                        SELECT SUM(wt.amount) 
                        FROM price_schema.wallet_transactions wt
                        WHERE wt.wallet_id = w.id 
                          AND wt.type = 'DEBIT' 
                          AND wt.status = 'SUCCESS' 
                          AND wt.is_delete = 0 
                          AND EXTRACT(MONTH FROM wt.created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
                          AND EXTRACT(YEAR FROM wt.created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
                    )
                    ELSE 0
                END, 0
            ) AS current_spent
        FROM price_schema.budget_control bc
        LEFT JOIN price_schema.wallet w ON bc.company_id = w.company_id AND w.is_delete = 0
        WHERE bc.company_id = ${companyId} AND bc.is_delete = 0
        ${whereCondition || ''}
        ORDER BY bc.id ASC
      `;

      const results = await db.executeExternalQuery(sql);
      return results;
    } catch (error) {
      console.error("BudgetControlService prepareQuery error:", error);
      throw error;
    }
  }

  override async createPostProcess(result: any, model: any, files: any): Promise<any> {
    if (model.id) {
      await BudgetAlertHistoryEntity.update({ budget_control_id: model.id, is_delete: 0 }, { is_delete: 1 });
    }
    return result;
  }

  static async checkAndTriggerAlert(companyId: number): Promise<void> {
    try {
      const budgetControlService = new BudgetControlService();
      const rows = await budgetControlService.prepareQuery({ company_id: companyId });

      for (const row of rows) {
        const budget = parseFloat(row.budget) || 0;
        const currentSpent = parseFloat(row.current_spent) || 0;

        // --- 1. Check and Trigger 100% Budget Breach Alert ---
        if (currentSpent >= budget) {
          let alertExists = false;

          if (row.type === BudgetPeriodType.DAILY) {
            const existingRecord = await BudgetAlertHistoryEntity.findOne({
              where: {
                budget_control_id: row.id,
                threshold_level: 100,
                alert_date: Raw(alias => `${alias} = CURRENT_DATE`),
                is_delete: 0
              }
            });
            alertExists = !!existingRecord;
          } else if (row.type === BudgetPeriodType.MONTHLY) {
            const existingRecord = await BudgetAlertHistoryEntity.findOne({
              where: {
                budget_control_id: row.id,
                threshold_level: 100,
                alert_date: Raw(alias => `EXTRACT(MONTH FROM ${alias}) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM ${alias}) = EXTRACT(YEAR FROM CURRENT_DATE)`),
                is_delete: 0
              }
            });
            alertExists = !!existingRecord;
          }

          if (!alertExists) {
            const budgetAlertHistoryService = new BudgetAlertHistoryService();
            const historyModel = new BudgetAlertHistoryModel();
            historyModel.budget_control_id = row.id;
            historyModel.company_id = companyId;
            historyModel.threshold_level = 100;
            historyModel.alert_period = row.type;
            historyModel.alert_date = new Date();
            const savedRecord = await budgetAlertHistoryService.createRecord(historyModel, null);

            const alertMessage = `Your ${row.type} Budget has reached 100% limit (Spent: ₹${currentSpent.toFixed(2)} / Budget: ₹${budget.toFixed(2)}).`;
            await WebSocketService.pushMessageToCompany(String(companyId), {
              event: WebhookEvents.BUDGET_BREACH,
              message: alertMessage,
              budget_control_id: row.id,
              budget_alert_id: savedRecord.id,
              name: row.name,
              type: row.type,
              current_spent: currentSpent,
              budget: budget,
              is_suspended: row.type === BudgetPeriodType.MONTHLY && !!row.auto_stop_resources
            });

            const webhookService = new WebhookService();
            const budgetCompany = await CompanyEntity.findOneBy({ id: companyId, is_delete: 0 });
            await webhookService.dispatchTemplatedAlert(companyId, 'BUDGET_BREACH', 'EXCEEDED', {
              period: row.type,
              totalSpent: `₹${currentSpent.toFixed(2)}`,
              budget: `₹${budget.toFixed(2)}`,
              workspace: budgetCompany ? (budgetCompany as any).company_name : '',
            });

            if (row.type === BudgetPeriodType.MONTHLY && !!row.auto_stop_resources) {
              await this.triggerAutoStopResources(companyId);
            }
          }

          continue;
        }

        const thresholds = [
          { level: 1, value: row.threshold_alert_1 !== null ? parseFloat(row.threshold_alert_1) : null },
          { level: 2, value: row.threshold_alert_2 !== null ? parseFloat(row.threshold_alert_2) : null },
          { level: 3, value: row.threshold_alert_3 !== null ? parseFloat(row.threshold_alert_3) : null }
        ].filter(t => t.value !== null);

        thresholds.sort((a, b) => b.value - a.value);

        for (const t of thresholds) {
          if (currentSpent >= t.value) {
            let alertExists = false;

            if (row.type === BudgetPeriodType.DAILY) {
              const existingRecord = await BudgetAlertHistoryEntity.findOne({
                where: {
                  budget_control_id: row.id,
                  threshold_level: t.level,
                  alert_date: Raw(alias => `${alias} = CURRENT_DATE`),
                  is_delete: 0
                }
              });
              alertExists = !!existingRecord;
            } else if (row.type === BudgetPeriodType.MONTHLY) {
              const existingRecord = await BudgetAlertHistoryEntity.findOne({
                where: {
                  budget_control_id: row.id,
                  threshold_level: t.level,
                  alert_date: Raw(alias => `EXTRACT(MONTH FROM ${alias}) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM ${alias}) = EXTRACT(YEAR FROM CURRENT_DATE)`),
                  is_delete: 0
                }
              });
              alertExists = !!existingRecord;
            }

            if (!alertExists) {
              const budgetAlertHistoryService = new BudgetAlertHistoryService();
              const historyModel = new BudgetAlertHistoryModel();
              historyModel.budget_control_id = row.id;
              historyModel.company_id = companyId;
              historyModel.threshold_level = t.level;
              historyModel.alert_period = row.type;
              historyModel.alert_date = new Date();
              const savedRecord = await budgetAlertHistoryService.createRecord(historyModel, null);

              const alertMessage = `Your ${row.type} Budget has reached threshold limit ${t.level} (Spent: ₹${currentSpent.toFixed(2)} / Budget: ₹${budget.toFixed(2)}).`;
              await WebSocketService.pushMessageToCompany(String(companyId), {
                event: WebhookEvents.BUDGET_BREACH,
                message: alertMessage,
                budget_control_id: row.id,
                budget_alert_id: savedRecord.id,
                name: row.name,
                type: row.type,
                current_spent: currentSpent,
                budget: budget,
                is_suspended: false
              });

              if (t.value >= 0.7 * budget) {
                const webhookService = new WebhookService();
                const thresholdCompany = await CompanyEntity.findOneBy({ id: companyId, is_delete: 0 });
                await webhookService.dispatchTemplatedAlert(companyId, 'BUDGET_BREACH', 'THRESHOLD', {
                  period: row.type,
                  percentage: String(Math.round((currentSpent / budget) * 100)),
                  totalSpent: `₹${currentSpent.toFixed(2)}`,
                  budget: `₹${budget.toFixed(2)}`,
                  workspace: thresholdCompany ? (thresholdCompany as any).company_name : '',
                });
              }
            }
            break;
          }
        }
      }
    } catch (error) {
      console.error("BudgetControlService checkAndTriggerAlert error:", error);
    }
  }

  public static async getActiveBudgetAlerts(companyId: number): Promise<any[]> {
    try {
      const unseenAlerts = await BudgetAlertHistoryEntity.find({
        where: {
          company_id: companyId,
          is_seen: false,
          is_delete: 0
        },
        order: {
          id: 'DESC'
        }
      });

      if (unseenAlerts.length === 0) {
        return [];
      }

      const budgetControlService = new BudgetControlService();
      const rows = await budgetControlService.prepareQuery({ company_id: companyId });
      const activeAlerts = [];
      const processedBudgetControlIds = new Set<number>();

      for (const alert of unseenAlerts) {
        if (processedBudgetControlIds.has(alert.budget_control_id)) {
          continue;
        }

        const row = rows.find(r => r.id === alert.budget_control_id);
        if (row) {
          const budget = parseFloat(row.budget) || 0;
          const currentSpent = parseFloat(row.current_spent) || 0;

          const message = alert.threshold_level === 100
            ? `Your ${row.type} Budget has reached 100% limit (Spent: ₹${currentSpent.toFixed(2)} / Budget: ₹${budget.toFixed(2)}).`
            : `Your ${row.type} Budget has reached threshold limit ${alert.threshold_level} (Spent: ₹${currentSpent.toFixed(2)} / Budget: ₹${budget.toFixed(2)}).`;

          activeAlerts.push({
            budget_alert_id: alert.id,
            threshold_level: alert.threshold_level,
            message: message,
            budget_control_id: row.id,
            name: row.name,
            type: row.type,
            current_spent: currentSpent,
            budget: budget
          });

          processedBudgetControlIds.add(alert.budget_control_id);
        }
      }

      return activeAlerts;
    } catch (error) {
      console.error('[BudgetControl] Error in getActiveBudgetAlerts:', error);
      return [];
    }
  }

  public static async checkIsSuspended(companyId: number): Promise<boolean> {
    try {
      const budgetControlService = new BudgetControlService();
      const rows = await budgetControlService.prepareQuery({ company_id: companyId });

      for (const row of rows) {
        const budget = parseFloat(row.budget) || 0;
        const currentSpent = parseFloat(row.current_spent) || 0;

        if (row.type === BudgetPeriodType.MONTHLY && !!row.auto_stop_resources && currentSpent >= budget) {
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('[BudgetControl] Error in checkIsSuspended:', error);
      return false;
    }
  }

  public static async markAlertAsSeen(alertHistoryId: number): Promise<void> {
    try {
      const alert = await BudgetAlertHistoryEntity.findOneBy({ id: alertHistoryId });
      if (alert) {
        await BudgetAlertHistoryEntity.update(
          { budget_control_id: alert.budget_control_id, is_seen: false, is_delete: 0 },
          { is_seen: true }
        );
        console.log(`[BudgetControl] Marked all unseen alerts for budget control ID ${alert.budget_control_id} as seen`);
      }
    } catch (error) {
      console.error('[BudgetControl] Error in markAlertAsSeen:', error);
      throw error;
    }
  }

  private static async triggerAutoStopResources(companyId: number): Promise<void> {
    try {
      console.log(`[BudgetControl] Triggering auto-stop-resources and ending terminate request to ${TERMINATE_RESOURCES} with org_id: ${companyId}`);
      const response = await axios.post(
        TERMINATE_RESOURCES,
        { org_id: String(companyId) },
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': TERMINATE_RESOURCES_API_KEY
          }
        }
      );
      console.log(`[BudgetControl] Auto-stop resources response:`, response.status, response.data);
    } catch (error: any) {
      console.error("[BudgetControl] Error in triggerAutoStopResources:", error.response?.data || error.message || error);
    }
  }
}

export default BudgetControlService;
