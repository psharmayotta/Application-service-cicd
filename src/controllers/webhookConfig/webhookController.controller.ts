import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import { StatusCode, ResponseStatus } from '../../config';
import WebhookConfigService from '../../services/webhookConfig/webhookConfigService.services';
import authMiddleware from '../../middlewares/authMiddleware';

export class WebhookController extends BaseController {
  constructor(
    path: APP_ROUTES.WEBHOOK_CONFIG,
    public router = express.Router(),
    public service: WebhookConfigService = new WebhookConfigService()
  ) {
    super(path, router, service);
  }

  public override _initialiseRoutes(): void {
    super._initialiseRoutes();
    this.router.post(`${this.path}/verify`, authMiddleware, this.verifyWebhook.bind(this));
    this.router.post(`${this.path}/active`, authMiddleware, this.toggleActive.bind(this));
    this.router.get(`${this.path}/get-users`, authMiddleware, this.getWebhookUsers.bind(this));
  }

  protected async verifyWebhook(req: express.Request, res: express.Response, _next: express.NextFunction) {
    const { platform, config } = req.body;
    this.service.verifyWebhookConfig(platform, config)
      .then(() => {
        this.sendResponse(StatusCode.SUCCESS, 'Webhook configuration verified successfully', null, null, res, ResponseStatus.SUCCESS);
      })
      .catch((err) => {
        const status = err && err.status ? err.status : ResponseStatus.INTERNAL_ERROR;
        const message = err && err.message ? err.message : 'An unexpected error occurred';
        this.sendResponse(StatusCode.FAILURE, '', null, message, res, status);
      });
  }

  protected async toggleActive(req: express.Request, res: express.Response, _next: express.NextFunction) {
    const { company_id, is_active, webhook_id } = req.body;
    this.service.toggleCompanyIntegrationsActive(company_id, is_active, webhook_id)
      .then(() => {
        this.sendResponse(StatusCode.SUCCESS, 'Webhook integrations status updated successfully', null, null, res, ResponseStatus.SUCCESS);
      })
      .catch((err) => {
        const status = err && err.status ? err.status : ResponseStatus.INTERNAL_ERROR;
        const message = err && err.message ? err.message : 'An unexpected error occurred';
        this.sendResponse(StatusCode.FAILURE, '', null, message, res, status);
      });
  }

  protected async getWebhookUsers(req: express.Request, res: express.Response, _next: express.NextFunction) {
    const companyId = req.query.company_id || req.body.company_id;
    this.service.getWebhookUsers(companyId)
      .then((data) => {
        this.sendResponse(StatusCode.SUCCESS, 'Webhook users fetched successfully', data, null, res, ResponseStatus.SUCCESS);
      })
      .catch((err) => {
        const status = err && err.status ? err.status : ResponseStatus.INTERNAL_ERROR;
        const message = err && err.message ? err.message : 'An unexpected error occurred';
        this.sendResponse(StatusCode.FAILURE, '', null, message, res, status);
      });
  }
}
