import axios from 'axios';
import { In } from 'typeorm';
import { AwsService } from '../../core/AwsService';
import { BaseServices } from '../baseService.services';
import { WebhookEntity } from '../../entities/webhookEntity';
import { WebhookIntegratedPlatformEntity } from '../../entities/webhookIntegratedPlatformEntity';
import { WebhookPlatformEntity } from '../../entities/webhookPlatformEntity';
import { IntegrationEntity } from '../../entities/integrationEntity';
import { CompanyIntegrationMapperEntity } from '../../entities/companyIntegrationMapperEntity';
import { WebhookModel } from '../../database/repository/webhookConfig/webhook.model';
import { WebhookDto } from '../../database/repository/webhookConfig/webhook.dto';
import { WebhookPlatform } from '../../config';
import { validateUrlForSsrf } from '../../utils/security/ssrfValidator';
import Database from '../../database/database';
import WebhookIntegratedPlatformService from './webhookIntegratedPlatformService.services';

export class WebhookConfigService extends BaseServices {
  constructor(entity: any = WebhookEntity, protected awsService: AwsService = new AwsService()) {
    super(entity, awsService);
  }

  getModel(): WebhookModel {
    return new WebhookModel();
  }

  getDTO() {
    return WebhookDto;
  }

  getModuleName(): string {
    return 'Webhook Config';
  }

  override createPreProcess(model: any, files: any): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        if (model.decryptToken && model.decryptToken.member_id) {
          model.user_id = model.decryptToken.member_id;
        }

        resolve(model);
      } catch (error) {
        console.error('Error in WebhookConfigService createPreProcess:', error);
        reject(error);
      }
    });
  }

  override transformModel(model: any): any {
    return model;
  }

  override createPostProcess(result: any, model: any, files: any): Promise<any> {
    return new Promise(async (resolve, reject) => {
      try {
        const ipService = new WebhookIntegratedPlatformService();
        const incomingPlatforms = model.platforms || [];

        if (model.id) {
          const updatedPlatformIds: number[] = [];
          const existingPlatforms = await WebhookIntegratedPlatformEntity.find({
            where: { webhook_id: result.id, is_delete: 0 }
          });

          for (const p of incomingPlatforms) {
            const ipModel = ipService.getModel();

            // Match by platform_id if p.id is not provided
            let targetId = p.id;
            if (!targetId) {
              const matched = existingPlatforms.find(ep => ep.platform_id === p.platform_id);
              if (matched) {
                targetId = matched.id;
              }
            }

            if (targetId) {
              ipModel.id = targetId;
            }
            ipModel.webhook_id = result.id;
            ipModel.platform_id = p.platform_id;
            ipModel.config = p.config;
            ipModel.events = p.events || [];
            ipModel.is_active = p.is_active !== undefined ? p.is_active : true;

            const savedIp = await ipService.createRecord(ipModel, null);
            updatedPlatformIds.push(savedIp.id);
          }

          for (const ep of existingPlatforms) {
            if (!updatedPlatformIds.includes(ep.id)) {
              await ipService.updateDeleteFlagData({ id: ep.id } as any);
            }
          }
        } else {
          for (const p of incomingPlatforms) {
            const ipModel = ipService.getModel();
            ipModel.webhook_id = result.id;
            ipModel.platform_id = p.platform_id;
            ipModel.config = p.config;
            ipModel.events = p.events || [];
            ipModel.is_active = p.is_active !== undefined ? p.is_active : true;
            await ipService.createRecord(ipModel, null);
          }
        }

        // Sync mapper state based on count of active webhooks
        if (result.company_id) {
          await this.syncCompanyIntegrationMapper(result.company_id);
        }

        const finalDetails = await this.prepareQueryById({ id: result.id } as any);
        resolve(finalDetails);
      } catch (error) {
        console.error('Error in WebhookConfigService createPostProcess:', error);
        reject(error);
      }
    });
  }

  private async verifySlack(config: any): Promise<void> {
    const urls = config.webhook_url;
    if (!urls) {
      throw { status: 400, message: 'Slack webhook configuration must include a valid webhook_url' };
    }
    const urlList = Array.isArray(urls) ? urls : [urls];
    if (urlList.length === 0) {
      throw { status: 400, message: 'Slack webhook configuration must include at least one webhook_url' };
    }

    for (const url of urlList) {
      try {
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname.toLowerCase();
        if (hostname !== 'slack.com' && !hostname.endsWith('.slack.com')) {
          throw new Error();
        }
      } catch (err: any) {
        throw { status: 400, message: 'Invalid Slack Webhook URL' };
      }

      try {
        await validateUrlForSsrf(url);
      } catch (err: any) {
        throw { status: 400, message: `SSRF validation failed for ${url}: ${err.message}` };
      }

      try {
        await axios.post(url, { text: 'Q0 Webhook Verification: Connection test successful! 🚀' }, { timeout: 5000 });
      } catch (err: any) {
        throw { status: 400, message: `Slack webhook validation failed for ${url}: ${err.response?.data || err.message}` };
      }
    }
  }

  private async verifyTeams(config: any): Promise<void> {
    const urls = config.webhook_url;
    if (!urls) {
      throw { status: 400, message: 'Teams webhook configuration must include a valid webhook_url' };
    }
    const urlList = Array.isArray(urls) ? urls : [urls];
    if (urlList.length === 0) {
      throw { status: 400, message: 'Teams webhook configuration must include at least one webhook_url' };
    }

    for (const url of urlList) {
      try {
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname.toLowerCase();
        const isValidTeamsHost = hostname.includes('office.com') || hostname.includes('logic.azure.com') || hostname.includes('powerplatform.com') || hostname.includes('powerautomate.com');
        if (!isValidTeamsHost) {
          throw new Error();
        }
      } catch (err: any) {
        throw { status: 400, message: 'Invalid Teams Webhook URL' };
      }

      try {
        await validateUrlForSsrf(url);
      } catch (err: any) {
        throw { status: 400, message: `SSRF validation failed for ${url}: ${err.message}` };
      }

      try {
        const payload = {
          '@type': 'MessageCard',
          '@context': 'http://schema.org/extensions',
          'themeColor': '0078D7',
          'title': 'Webhook Connection Test',
          'text': 'Q0 Webhook Verification: Connection test successful! 🚀'
        };
        await axios.post(url, payload, { timeout: 5000 });
      } catch (err: any) {
        throw { status: 400, message: `Teams webhook validation failed for ${url}: ${err.response?.data || err.message}` };
      }
    }
  }

  private async verifyPagerDuty(config: any): Promise<void> {
    const keys = config.integration_key;
    if (!keys) {
      throw { status: 400, message: 'PagerDuty configuration must include an integration_key' };
    }
    const keyList = Array.isArray(keys) ? keys : [keys];
    if (keyList.length === 0) {
      throw { status: 400, message: 'PagerDuty configuration must include at least one integration_key' };
    }

    for (const key of keyList) {
      const payload = {
        routing_key: key,
        event_action: 'trigger',
        payload: {
          summary: 'Q0 Webhook Verification: Connection test successful! 🚀',
          source: 'Q0 Application Service',
          severity: 'info'
        }
      };
      try {
        await axios.post('https://events.pagerduty.com/v2/enqueue', payload, { timeout: 5000 });
      } catch (err: any) {
        const errorDetail = err.response?.data?.errors?.join(', ') || err.response?.data?.message || err.message;
        throw { status: 400, message: `PagerDuty validation failed for key ${key}: ${errorDetail}` };
      }
    }
  }

  private async verifyVictorOps(config: any): Promise<void> {
    const urls = config.integration_url;
    const routingKeys = config.routing_key;
    if (!urls) {
      throw { status: 400, message: 'VictorOps configuration must include a valid integration_url' };
    }
    const urlList = Array.isArray(urls) ? urls : [urls];
    const routingKeyList = Array.isArray(routingKeys) ? routingKeys : [routingKeys];

    if (urlList.length === 0) {
      throw { status: 400, message: 'VictorOps configuration must include at least one integration_url' };
    }

    for (let i = 0; i < urlList.length; i++) {
      let url = urlList[i];
      let routingKey = routingKeyList[i] || routingKeyList[0] || 'default';

      try {
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname.toLowerCase();
        if (hostname !== 'alert.victorops.com' && !hostname.endsWith('.victorops.com')) {
          throw new Error();
        }
      } catch (err: any) {
        throw { status: 400, message: 'Invalid VictorOps Webhook URL' };
      }

      const parts = url.split('/alert/');
      if (parts.length === 2) {
        const subparts = parts[1].split('/');
        if (subparts.length > 1) {
          const integrationKey = subparts[0];
          const urlRoutingKey = subparts[1];
          url = `${parts[0]}/alert/${integrationKey}`;
          urlList[i] = url;

          if (!routingKey || routingKey === 'default') {
            if (urlRoutingKey && urlRoutingKey !== '$routing_key') {
              routingKey = urlRoutingKey;
            }
          }
        }
      }

      if (!routingKey || routingKey === '') {
        routingKey = 'default';
      }
      routingKeyList[i] = routingKey;

      const finalUrl = url.includes(routingKey) ? url : `${url}/${routingKey}`;
      try {
        await validateUrlForSsrf(finalUrl);
      } catch (err: any) {
        throw { status: 400, message: `SSRF validation failed for ${finalUrl}: ${err.message}` };
      }

      try {
        const payload = {
          message_type: 'INFO',
          entity_id: 'Q0 Alert Verification',
          entity_display_name: 'Q0 Webhook Verification',
          state_message: 'Your VictorOps webhook integration has been verified successfully. 🚀',
          monitoring_tool: 'Q0 Application Service'
        };
        await axios.post(finalUrl, payload, { timeout: 5000 });
      } catch (err: any) {
        throw { status: 400, message: `VictorOps validation failed for ${finalUrl}: ${err.response?.data || err.message}` };
      }
    }

    config.integration_url = Array.isArray(urls) ? urlList : urlList[0];
    config.routing_key = Array.isArray(routingKeys) ? routingKeyList : routingKeyList[0];
  }

  private async verifyMail(config: any): Promise<void> {
    const emails = config.emails;
    if (!Array.isArray(emails) || emails.length === 0) {
      throw { status: 400, message: 'Mail configuration must include a non-empty array of email addresses' };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of emails) {
      if (typeof email !== 'string' || !emailRegex.test(email)) {
        throw { status: 400, message: `Mail configuration contains an invalid email address: ${email}` };
      }
    }
  }

  public async verifyWebhookConfig(platformName: string, config: any): Promise<void> {
    const platform = platformName ? platformName.toUpperCase() : null;
    const finalConfig = config || {};

    switch (platform) {
      case WebhookPlatform.SLACK:
        await this.verifySlack(finalConfig);
        break;
      case WebhookPlatform.TEAMS:
        await this.verifyTeams(finalConfig);
        break;
      case WebhookPlatform.MAIL:
        await this.verifyMail(finalConfig);
        break;
      case WebhookPlatform.PAGERDUTY:
        await this.verifyPagerDuty(finalConfig);
        break;
      case WebhookPlatform.VICTOROPS:
        await this.verifyVictorOps(finalConfig);
        break;
      default:
        throw { status: 400, message: `Unsupported webhook platform: ${platform}` };
    }
  }

  async prepareQuery(param: any): Promise<any> {
    try {
      const companyId = parseInt(param.company_id, 10);
      if (isNaN(companyId)) {
        return [];
      }
      let whereConditions = "";
      if (param.is_active !== undefined && param.is_active !== null) {
        whereConditions += ` AND i.is_active = ${param.is_active}`;
      }
      if (param.user_id) {
        let userIds: number[] = [];
        if (Array.isArray(param.user_id)) {
          userIds = param.user_id.map((id: any) => parseInt(id, 10)).filter((id: number) => !isNaN(id));
        } else if (typeof param.user_id === 'string') {
          userIds = param.user_id.split(',').map((id: string) => parseInt(id.trim(), 10)).filter((id: number) => !isNaN(id));
        } else {
          const parsed = parseInt(param.user_id, 10);
          if (!isNaN(parsed)) {
            userIds = [parsed];
          }
        }

        if (userIds.length > 0) {
          whereConditions += ` AND i.user_id IN (${userIds.join(', ')})`;
        }
      }
      if (param.platform_id) {
        let platformIds: number[] = [];
        if (Array.isArray(param.platform_id)) {
          platformIds = param.platform_id.map((id: any) => parseInt(id, 10)).filter((id: number) => !isNaN(id));
        } else if (typeof param.platform_id === 'string') {
          platformIds = param.platform_id.split(',').map((id: string) => parseInt(id.trim(), 10)).filter((id: number) => !isNaN(id));
        } else {
          const parsed = parseInt(param.platform_id, 10);
          if (!isNaN(parsed)) {
            platformIds = [parsed];
          }
        }

        if (platformIds.length > 0) {
          whereConditions += ` AND EXISTS (
            SELECT 1 FROM integration.webhook_integrated_platforms 
            WHERE webhook_id = i.id AND platform_id IN (${platformIds.join(', ')}) AND is_delete = 0
          )`;
        }
      }

      let searchCondition = "";
      if (param.search_text) {
        const searchText = param.search_text.trim().toLowerCase();
        searchCondition = ` AND LOWER(i.name) LIKE '%${searchText}%'`;
      }

      const db = Database.getInstance();

      // Get total count
      const countSql = `
        SELECT COUNT(DISTINCT i.id) as total
        FROM integration.webhook i
        LEFT JOIN integration.webhook_integrated_platforms ip ON ip.webhook_id = i.id
        WHERE i.company_id = ${companyId} AND i.is_delete = 0 ${whereConditions} ${searchCondition}
      `;
      const countResult = await db.executeExternalQuery(countSql);
      const total = countResult && countResult[0] ? parseInt(countResult[0].total, 10) : 0;

      let limitOffsetClause = "";
      if (param.pageNumber && param.pageSize) {
        const pageNumber = parseInt(param.pageNumber, 10);
        const pageSize = parseInt(param.pageSize, 10);
        if (!isNaN(pageNumber) && !isNaN(pageSize) && pageNumber > 0 && pageSize > 0) {
          const offset = (pageNumber - 1) * pageSize;
          limitOffsetClause = ` LIMIT ${pageSize} OFFSET ${offset}`;
        }
      }

      const sql = `
        SELECT 
          i.id,
          i.company_id,
          i.user_id,
          m.full_name as created_by,
          m.profile_picture as created_by_image,
          i.name,
          i.is_active,
          i.created_at,
          i.modified_at,
          COALESCE(
            json_agg(
              json_build_object(
                'id', ip.id,
                'webhook_id', ip.webhook_id,
                'platform_id', ip.platform_id,
                'platform_name', wp.name,
                'platform_icon', wp.icon,
                'events', ip.events,
                'config', ip.config,
                'is_active', ip.is_active,
                'created_at', ip.created_at,
                'modified_at', ip.modified_at
              )
            ) FILTER (WHERE ip.id IS NOT NULL AND ip.is_delete = 0),
            '[]'
          ) as platforms
        FROM integration.webhook i
        LEFT JOIN v0_dev_yotta.members m ON i.user_id = m.id
        LEFT JOIN integration.webhook_integrated_platforms ip ON ip.webhook_id = i.id
        LEFT JOIN integration.webhook_platforms wp ON ip.platform_id = wp.id
        WHERE i.company_id = ${companyId} AND i.is_delete = 0 ${whereConditions} ${searchCondition}
        GROUP BY i.id, m.id, m.full_name, m.profile_picture
        ORDER BY i.id DESC
        ${limitOffsetClause}
      `;

      const results = await db.executeExternalQuery(sql);
      if (results && results.length > 0) {
        for (const res of results) {
          if (res.created_by_image) {
            res.created_by_image = await this.generateSignedUrl('members', res.user_id, res.created_by_image);
          }
          if (res.platforms && Array.isArray(res.platforms)) {
            for (const p of res.platforms) {
              if (p.platform_icon) {
                p.platform_icon = await this.generateSignedUrl('webhook_platforms', p.platform_id, p.platform_icon);
              }
            }
          }
        }
      }

      if (param.pageNumber && param.pageSize) {
        return {
          data: results,
          pagination: { total, pageSize: parseInt(param.pageSize, 10), pageNumber: parseInt(param.pageNumber, 10) }
        };
      }
      return results;
    } catch (error) {
      console.error('WebhookConfigService prepareQuery error:', error);
      throw error;
    }
  }

  async prepareQueryById(param: any): Promise<any> {
    try {
      const id = parseInt(param.id, 10);
      if (isNaN(id)) {
        return null;
      }

      const db = Database.getInstance();
      const sql = `
        SELECT 
          i.id,
          i.company_id,
          i.user_id,
          m.full_name as created_by,
          i.name,
          i.is_active,
          i.created_at,
          i.modified_at,
          COALESCE(
            json_agg(
              json_build_object(
                'id', ip.id,
                'webhook_id', ip.webhook_id,
                'platform_id', ip.platform_id,
                'platform_name', wp.name,
                'platform_icon', wp.icon,
                'events', ip.events,
                'config', ip.config,
                'is_active', ip.is_active,
                'created_at', ip.created_at,
                'modified_at', ip.modified_at
              )
            ) FILTER (WHERE ip.id IS NOT NULL AND ip.is_delete = 0),
            '[]'
          ) as platforms
        FROM integration.webhook i
        LEFT JOIN v0_dev_yotta.members m ON i.user_id = m.id
        LEFT JOIN integration.webhook_integrated_platforms ip ON ip.webhook_id = i.id
        LEFT JOIN integration.webhook_platforms wp ON ip.platform_id = wp.id
        WHERE i.id = ${id} AND i.is_delete = 0
        GROUP BY i.id, m.id
      `;

      const results = await db.executeExternalQuery(sql);
      const res = results && results.length > 0 ? results[0] : null;
      if (res) {
        const platforms = res.platforms || [];
        for (const p of platforms) {
          if (p.platform_icon) {
            p.platform_icon = await this.generateSignedUrl('webhook_platforms', p.platform_id, p.platform_icon);
          }
        }
      }
      return res;
    } catch (error) {
      console.error('WebhookConfigService prepareQueryById error:', error);
      throw error;
    }
  }

  public async toggleCompanyIntegrationsActive(companyId: number, isActive: boolean, webhookId?: any): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const parsedCompanyId = parseInt(companyId as any, 10);
        if (isNaN(parsedCompanyId)) {
          return reject({ status: 400, message: 'Invalid company ID' });
        }

        const parsedWebhookId = webhookId ? parseInt(webhookId as any, 10) : null;

        if (parsedWebhookId && !isNaN(parsedWebhookId)) {
          await WebhookEntity.update({ id: parsedWebhookId, company_id: parsedCompanyId, is_delete: 0 }, { is_active: isActive });
          await WebhookIntegratedPlatformEntity.update({ webhook_id: parsedWebhookId, is_delete: 0 }, { is_active: isActive });
        } else {
          const integrations = await WebhookEntity.find({
            where: { company_id: parsedCompanyId, is_delete: 0 },
            select: ['id']
          });

          const integrationIds = integrations.map(i => i.id);
          await WebhookEntity.update({ company_id: parsedCompanyId, is_delete: 0 }, { is_active: isActive });

          if (integrationIds.length > 0) {
            await WebhookIntegratedPlatformEntity.update({ webhook_id: In(integrationIds), is_delete: 0 }, { is_active: isActive });
          }
        }

        // Sync mapper state based on count of active webhooks
        await this.syncCompanyIntegrationMapper(parsedCompanyId);

        resolve();
      } catch (error) {
        console.error('Error in WebhookConfigService toggleCompanyIntegrationsActive:', error);
        reject(error);
      }
    });
  }

  public async syncCompanyIntegrationMapper(companyId: number): Promise<void> {
    try {
      const activeCount = await WebhookEntity.countBy({
        company_id: companyId,
        is_active: true,
        is_delete: 0
      });
      const hasActiveWebhooks = activeCount > 0;

      // Integration ID for Custom Webhook is 1
      let mapper = await CompanyIntegrationMapperEntity.findOne({
        where: { company_id: companyId, integration_id: 1, is_delete: 0 }
      });

      if (mapper) {
        mapper.is_active = hasActiveWebhooks;
        await mapper.save();
      } else {
        mapper = new CompanyIntegrationMapperEntity();
        mapper.company_id = companyId;
        mapper.integration_id = 1;
        mapper.is_active = hasActiveWebhooks;
        await mapper.save();
      }
      console.log(`[Sync] Updated integration mapping for company ${companyId} to is_active = ${hasActiveWebhooks}`);
    } catch (error: any) {
      console.error(`[Sync Error] Failed to sync integration mapping for company ${companyId}:`, error.message);
    }
  }


  public async getWebhookUsers(companyId?: any): Promise<any> {
    try {
      const db = Database.getInstance();
      const sql = `
        SELECT DISTINCT
          m.id as user_id,
          m.full_name
        FROM integration.webhook w
        JOIN v0_dev_yotta.members m ON w.user_id = m.id
        WHERE w.is_delete = 0 AND w.company_id = ${companyId}
        ORDER BY m.full_name ASC
      `;
      const results = await db.executeExternalQuery(sql);
      return results;
    } catch (error) {
      console.error('WebhookConfigService getWebhookUsers error:', error);
      throw error;
    }
  }

}

export default WebhookConfigService;
