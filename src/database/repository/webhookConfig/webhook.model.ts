import { InferModel } from '../InferModel/InferModel.model';

export class WebhookModel extends InferModel {
  company_id: number = null;
  user_id: number = null;
  name: string = null;
  is_active: boolean = true;
  decryptToken: any = null;
  platforms: any[] = [];
}

export class WebhookIntegratedPlatformModel extends InferModel {
  webhook_id: number = null;
  platform_id: number = null;
  config: any = {};
  is_active: boolean = true;
  events: string[] = [];
}
