import axios from 'axios';
import { KAFKAPRODUCERS, ModuleType, WebhookPlatform, FRONTENDDOMAIN, CDN_LINK } from '../../config';
import { KafkaService } from '../../utils/kafka/KafkaService';
import Database from '../../database/database';
import { getWebhookTemplate, getFallbackTemplate, WebhookTemplateVariables, WebhookFact } from '../../utils/webhook/webhookTemplates';

// Strip HTML tags from a string (for non-email platforms)
function stripHtml(str: string): string {
    return str.replace(/<[^>]*>/g, '').trim();
}

export class WebhookService {

  // ─────────────────────────────────────────────────────────────────────────
  // PLATFORM SENDERS
  // ─────────────────────────────────────────────────────────────────────────

  public async sendSlackAlert(url: string, title: string, text: string, facts: WebhookFact[] = []): Promise<void> {
    try {
      const factsText = facts.length > 0
        ? '\n' + facts.map(f => `• *${f.name}:* ${f.value}`).join('\n')
        : '';
      const message = `*${title}*\n${text}${factsText}`;
      await axios.post(url, { text: message }, { timeout: 5000 });
      console.log('Slack webhook alert sent successfully.');
    } catch (err: any) {
      console.error('Slack post failed:', err.message);
    }
  }

  public async sendTeamsAlert(url: string, title: string, text: string, facts: WebhookFact[] = [], status?: string): Promise<void> {
    try {
      const sections: any[] = [];
      if (facts.length > 0) {
        sections.push({ facts: facts.map(f => ({ name: f.name, value: f.value })) });
      }
      const payload = {
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        'themeColor': '6C63FF',
        'title': title,
        'text': text,
        'sections': sections
      };
      await axios.post(url, payload, { timeout: 5000 });
      console.log('Teams webhook alert sent successfully.');
    } catch (err: any) {
      console.error('Teams post failed:', err.message);
    }
  }

  public async sendPagerDutyAlert(routingKey: string, title: string, text: string, severity: string = 'error', facts: WebhookFact[] = []): Promise<void> {
    try {
      const customDetails: Record<string, string> = {};
      facts.forEach(f => { customDetails[f.name] = f.value; });
      const payload = {
        routing_key: routingKey,
        event_action: 'trigger',
        payload: {
          summary: title,
          source: 'Q0 Platform',
          severity: severity,
          custom_details: customDetails
        }
      };
      await axios.post('https://events.pagerduty.com/v2/enqueue', payload, { timeout: 5000 });
      console.log('PagerDuty webhook alert sent successfully.');
    } catch (err: any) {
      console.error('PagerDuty post failed:', err.message);
    }
  }

  public async sendVictorOpsAlert(url: string, routingKey: string, title: string, text: string): Promise<void> {
    try {
      const payload = {
        message_type: 'CRITICAL',
        entity_id: 'Q0 Platform Alert',
        entity_display_name: title,
        state_message: text,
        monitoring_tool: 'Q0 Platform'
      };
      const finalUrl = url.includes(routingKey) ? url : `${url}/${routingKey}`;
      await axios.post(finalUrl, payload, { timeout: 5000 });
      console.log('VictorOps webhook alert sent successfully.');
    } catch (err: any) {
      console.error('VictorOps post failed:', err.message);
    }
  }

  public async sendMailAlert(
    emails: string[],
    subject: string,
    body: string,
    facts: WebhookFact[] = [],
    ctaText?: string,
    ctaUrl?: string
  ): Promise<void> {
    try {
      const kafkaService = KafkaService.getInstance();
      const fullCtaUrl = ctaUrl ? `${FRONTENDDOMAIN}${ctaUrl}` : '';
      for (const email of emails) {
        const kafkaMessage = {
          module: ModuleType.EMAIL,
          request: {
            to: email,
            emailcode: 'WEBHOOK_ALERT',
            variables: {
              cdn_link: CDN_LINK,
              subject: subject,
              title: subject,
              message: body,
              facts: facts,
              cta_text: ctaText || '',
              cta_url: fullCtaUrl,
              year: new Date().getFullYear().toString()
            }
          }
        };
        await kafkaService.sendMessage(KAFKAPRODUCERS.EMAIL, kafkaMessage);
      }
      console.log('Mail alerts sent successfully.');
    } catch (err: any) {
      console.error('Mail Alert failed:', err.message);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DISPATCH (template-based)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Dispatch a templated webhook alert.
   * Looks up the template by module + action, interpolates variables, and sends to all configured platforms.
   * 
   * @param companyId - Company to dispatch for
   * @param module - Module name (e.g. 'Deployment', 'Training', 'BUDGET_BREACH')
   * @param action - Action/status (e.g. 'READY', 'FAILED', 'CREATED', 'EXCEEDED')
   * @param variables - Template variables to interpolate
   */
  public async dispatchTemplatedAlert(
    companyId: number,
    module: string,
    action: string,
    variables: WebhookTemplateVariables = {}
  ): Promise<void> {
    const template = getWebhookTemplate(module, action, variables);
    if (!template) {
      console.warn(`[WebhookService] No template found for module="${module}" action="${action}". Skipping.`);
      return;
    }

    await this.dispatchToAllPlatforms(companyId, module, template);
  }

  /**
   * Backward-compatible dispatchAlert.
   * Accepts raw title/text/facts (for existing callers that haven't migrated to templates yet).
   * Tries to find a template match by eventType; falls back to raw payload if none found.
   */
  public async dispatchAlert(
    companyId: number,
    eventType: string,
    payload: { title: string; text: string; facts: { name: string; value: string }[] }
  ): Promise<void> {
    const template = getFallbackTemplate(eventType, payload.title, payload.text, payload.facts);
    await this.dispatchToAllPlatforms(companyId, eventType, template);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTERNAL: Send to all configured platforms
  // ─────────────────────────────────────────────────────────────────────────

  public async dispatchToAllPlatformsPublic(
    companyId: number,
    eventType: string,
    template: { subject: string; body: string; facts: WebhookFact[]; ctaText: string; ctaUrl: string; status: string }
  ): Promise<void> {
    return this.dispatchToAllPlatforms(companyId, eventType, template);
  }

  private async dispatchToAllPlatforms(
    companyId: number,
    eventType: string,
    template: { subject: string; body: string; facts: WebhookFact[]; ctaText: string; ctaUrl: string; status: string }
  ): Promise<void> {
    try {
      const activeConfigs = await Database.getInstance().executeExternalQuery(`
        SELECT 
          ip.id,
          wp.name as platform,
          ip.config,
          ip.events,
          ip.is_active
        FROM integration.webhook i
        JOIN integration.webhook_integrated_platforms ip ON ip.webhook_id = i.id
        JOIN integration.webhook_platforms wp ON ip.platform_id = wp.id
        WHERE i.company_id = $1 
          AND i.is_active = true 
          AND i.is_delete = 0
          AND ip.is_active = true
          AND ip.is_delete = 0
          AND wp.is_active = true
          AND wp.is_delete = 0
      `, [companyId]);

      const matchedConfigs = activeConfigs.filter(c => Array.isArray(c.events) && c.events.includes(eventType));

      for (const c of matchedConfigs) {
        const platform = c.platform ? c.platform.toUpperCase() as WebhookPlatform : null;
        const config = c.config || {};

        // Plain text facts for non-email platforms (strip HTML tags)
        const plainFacts = template.facts.map(f => ({ name: f.name, value: stripHtml(f.value) || template.status }));

        switch (platform) {
          case WebhookPlatform.SLACK:
            if (config.webhook_url) {
              const urls = Array.isArray(config.webhook_url) ? config.webhook_url : [config.webhook_url];
              for (const url of urls) {
                await this.sendSlackAlert(url, template.subject, template.body, []);
              }
            }
            break;

          case WebhookPlatform.TEAMS:
            if (config.webhook_url) {
              const urls = Array.isArray(config.webhook_url) ? config.webhook_url : [config.webhook_url];
              for (const url of urls) {
                await this.sendTeamsAlert(url, template.subject, template.body, plainFacts, template.status);
              }
            }
            break;

          case WebhookPlatform.MAIL:
            if (Array.isArray(config.emails) && config.emails.length > 0) {
              await this.sendMailAlert(config.emails, template.subject, template.body, template.facts, template.ctaText, template.ctaUrl);
            }
            break;

          case WebhookPlatform.PAGERDUTY:
            if (config.integration_key) {
              const keys = Array.isArray(config.integration_key) ? config.integration_key : [config.integration_key];
              for (const key of keys) {
                await this.sendPagerDutyAlert(key, template.subject, template.body, config.severity || 'error', []);
              }
            }
            break;

          case WebhookPlatform.VICTOROPS:
            if (config.integration_url) {
              const urls = Array.isArray(config.integration_url) ? config.integration_url : [config.integration_url];
              const routingKeys = Array.isArray(config.routing_key) ? config.routing_key : [config.routing_key];
              for (let i = 0; i < urls.length; i++) {
                const url = urls[i];
                const routingKey = routingKeys[i] || routingKeys[0] || '';
                await this.sendVictorOpsAlert(url, routingKey, template.subject, template.body);
              }
            }
            break;

          default:
            console.warn(`[WebhookService] Unsupported platform: ${platform}`);
        }
      }
    } catch (error) {
      console.error('Error in WebhookService dispatch:', error);
    }
  }
}

export default WebhookService;
