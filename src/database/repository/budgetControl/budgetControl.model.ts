import { InferModel } from '../InferModel/InferModel.model';

export class BudgetControlModel extends InferModel {
  company_id: number = null;
  user_id: number = null;
  name: string = '';
  type: string = '';
  budget: number = 0.0;
  threshold_alert_1: number = null;
  threshold_alert_2: number = null;
  threshold_alert_3: number = null;
  auto_stop_resources: boolean = false;
  is_custom_threshold: boolean = false;
  decryptToken: any = null;
}
