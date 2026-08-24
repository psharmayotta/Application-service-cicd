import { InferModel } from '../InferModel/InferModel.model';

export class BudgetAlertHistoryModel extends InferModel {
  budget_control_id: number = null;
  company_id: number = null;
  threshold_level: number = null;
  alert_period: string = '';
  alert_date: Date = null;
  is_seen: boolean = false;
}
