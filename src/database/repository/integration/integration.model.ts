import { InferModel } from '../InferModel/InferModel.model';

export class IntegrationModel extends InferModel {
  integration_name: string = null;
  description: string = null;
  icon: string = null;
  is_active: boolean = true;
  company_id: number = null;
}
