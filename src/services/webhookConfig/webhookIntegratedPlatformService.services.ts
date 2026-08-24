import { AwsService } from '../../core/AwsService';
import { BaseServices } from '../baseService.services';
import { WebhookIntegratedPlatformEntity } from '../../entities/webhookIntegratedPlatformEntity';
import { WebhookIntegratedPlatformModel } from '../../database/repository/webhookConfig/webhook.model';
import { WebhookIntegratedPlatformDto } from '../../database/repository/webhookConfig/webhook.dto';

export class WebhookIntegratedPlatformService extends BaseServices {
  constructor(entity: any = WebhookIntegratedPlatformEntity, protected awsService: AwsService = new AwsService()) {
    super(entity, awsService);
  }

  getModel(): WebhookIntegratedPlatformModel {
    return new WebhookIntegratedPlatformModel();
  }

  getDTO(): any {
    return WebhookIntegratedPlatformDto;
  }

  getModuleName(): string {
    return 'Integrated Platform';
  }
}

export default WebhookIntegratedPlatformService;
