import { AwsService } from '../../core/AwsService';
import { BaseServices } from '../baseService.services';
import { IntegrationEntity } from '../../entities/integrationEntity';
import { CompanyIntegrationMapperEntity } from '../../entities/companyIntegrationMapperEntity';
import { IntegrationModel } from '../../database/repository/integration/integration.model';
import { IntegrationDto } from '../../database/repository/integration/integration.dto';
import { MetaModel } from '../../core/MetaModel';
import Database from '../../database/database';
import { WebhookConfigService } from '../webhookConfig/webhookConfigService.services';

export class IntegrationService extends BaseServices {
  constructor(entity: any = IntegrationEntity, protected awsService: AwsService = new AwsService()) {
    super(entity, awsService);
  }

  getModel(): IntegrationModel {
    return new IntegrationModel();
  }

  getDTO(): any {
    return IntegrationDto;
  }

  getModuleName(): string {
    return 'Integration';
  }

  getMetaModel(): MetaModel {
    return new MetaModel('integrations', 'icon', [
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

  public async toggleIntegrationActive(companyId: number, integrationId: number, isActive: boolean): Promise<void> {
    try {
      const mapperCompanyId = parseInt(companyId as any, 10);
      const mapperIntegrationId = parseInt(integrationId as any, 10);
      if (isNaN(mapperCompanyId) || isNaN(mapperIntegrationId)) {
        throw { status: 400, message: 'Invalid company ID or Integration ID' };
      }

      // 1. Upsert into company_integration_mapper
      let mapper = await CompanyIntegrationMapperEntity.findOne({
        where: { company_id: mapperCompanyId, integration_id: mapperIntegrationId, is_delete: 0 }
      });

      if (mapper) {
        mapper.is_active = isActive;
        await mapper.save();
      } else {
        mapper = new CompanyIntegrationMapperEntity();
        mapper.company_id = mapperCompanyId;
        mapper.integration_id = mapperIntegrationId;
        mapper.is_active = isActive;
        await mapper.save();
      }
      console.log(`✅ Upserted company_integration_mapper for company ${mapperCompanyId}, integration ${mapperIntegrationId} to ${isActive}`);

      // 2. Toggle corresponding webhooks for the company
      const webhookConfigService = new WebhookConfigService();
      await webhookConfigService.toggleCompanyIntegrationsActive(mapperCompanyId, isActive);
      console.log(`✅ Integration status changed. Toggled all webhooks for company ${mapperCompanyId} to ${isActive}`);
    } catch (error) {
      console.error('Error in IntegrationService toggleIntegrationActive:', error);
      throw error;
    }
  }



  async prepareQuery(param: any): Promise<any> {
    try {
      let companyId = param.company_id;
      const parsedCompanyId = companyId ? parseInt(companyId as any, 10) : null;
      const db = Database.getInstance();
      const sql = `
          SELECT 
            i.id, 
            i.integration_name, 
            i.description, 
            i.icon, 
            COALESCE(ci.is_active, false) as is_active, 
            i.created_at, 
            i.modified_at
          FROM integration.integrations i
          LEFT JOIN integration.company_integration_mapper ci 
            ON i.id = ci.integration_id AND ci.company_id = ${parsedCompanyId} AND ci.is_delete = 0
          WHERE i.is_delete = 0
          ORDER BY i.id ASC
        `;
      const results = await db.executeExternalQuery(sql);
      if (results && results.length > 0) {
        for (const res of results) {
          if (res.icon) {
            res.icon = await this.generateSignedUrl('integrations', res.id, res.icon);
          }
        }
      }
      return results;
    } catch (error) {
      console.error('IntegrationService prepareQuery error:', error);
      throw error;
    }
  }
}

export default IntegrationService;
