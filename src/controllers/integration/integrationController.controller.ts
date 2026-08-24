import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import IntegrationService from '../../services/integration/integrationService.services';
import authMiddleware from '../../middlewares/authMiddleware';
import { StatusCode, ResponseStatus } from '../../config';

export class IntegrationController extends BaseController {
  constructor(
    path: APP_ROUTES.INTEGRATIONS,
    public router = express.Router(),
    public service: IntegrationService = new IntegrationService()
  ) {
    super(path, router, service);
  }

  public override _initialiseRoutes(): void {
    super._initialiseRoutes();
    this.router.post(`${this.path}/toggle-active`, authMiddleware, this.toggleActive.bind(this));
  }

  protected async toggleActive(req: express.Request, res: express.Response, _next: express.NextFunction) {
    const { company_id, integration_id, is_active } = req.body;

    this.service.toggleIntegrationActive(company_id, integration_id, is_active)
      .then(() => {
        this.sendResponse(StatusCode.SUCCESS, 'Integration status updated successfully', null, null, res, ResponseStatus.SUCCESS);
      })
      .catch((err) => {
        const status = err && err.status ? err.status : ResponseStatus.INTERNAL_ERROR;
        const message = err && err.message ? err.message : 'An unexpected error occurred';
        this.sendResponse(StatusCode.FAILURE, '', null, message, res, status);
      });
  }
}

export default IntegrationController;
