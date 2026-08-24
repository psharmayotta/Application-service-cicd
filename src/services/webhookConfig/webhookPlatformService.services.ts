import { AwsService } from '../../core/AwsService';
import { BaseServices } from '../baseService.services';
import { WebhookPlatformEntity } from '../../entities/webhookPlatformEntity';
import { WebhookPlatformModel } from '../../database/repository/webhookConfig/webhookPlatform.model';
import { WebhookPlatformDto } from '../../database/repository/webhookConfig/webhookPlatform.dto';
import { MetaModel } from '../../core/MetaModel';
import Database from '../../database/database';

export class WebhookPlatformService extends BaseServices {
  constructor(entity: any = WebhookPlatformEntity, protected awsService: AwsService = new AwsService()) {
    super(entity, awsService);
  }

  getModel(): WebhookPlatformModel {
    return new WebhookPlatformModel();
  }

  getDTO(): any {
    return WebhookPlatformDto;
  }

  getModuleName(): string {
    return 'Webhook Platform';
  }

  getMetaModel(): MetaModel {
    return new MetaModel('webhook_platforms', 'icon', [
      {
        fileKey: 'icon',
        colName: 'icon',
        allowedSize: 1024 * 1024 * 5,
        require: 'false',
        allowedExtensions: [
          'image/png',
          'image/jpg',
          'image/jpeg',
          'image/webp',
          'image/svg+xml',
          'image/svg'
        ]
      }
    ]);
  }

  async prepareQuery(param: any): Promise<any> {
    try {
      const db = Database.getInstance();
      const sql = `
        SELECT id, name, icon, is_active, created_at, modified_at
        FROM integration.webhook_platforms
        WHERE is_delete = 0
        ORDER BY id ASC
      `;
      const results = await db.executeExternalQuery(sql);
      if (results && results.length > 0) {
        for (const res of results) {
          if (res.icon) {
            res.icon = await this.generateSignedUrl('webhook_platforms', res.id, res.icon);
          }
        }
      }
      return results;
    } catch (error) {
      console.error('WebhookPlatformService prepareQuery error:', error);
      throw error;
    }
  }
}

export default WebhookPlatformService;
