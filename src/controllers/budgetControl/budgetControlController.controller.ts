import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import BudgetControlService from '../../services/budgetControl/budgetControlService.services';
import authMiddleware from '../../middlewares/authMiddleware';
import { ResponseStatus, StatusCode } from '../../config';

export class BudgetControlController extends BaseController {
  constructor(path: APP_ROUTES.BUDGET_CONTROL, public router = express.Router(), public service: BudgetControlService = new BudgetControlService()) {
    super(path, router, service);
  }

  override _initialiseRoutes(): void {
    super._initialiseRoutes();
    this.router.post(`${this.path}/seen-alert`, authMiddleware, this.seenAlert.bind(this));
  }

  private async seenAlert(req: express.Request, res: express.Response, _next: express.NextFunction) {
    try {
      const budgetAlertHistoryId = parseInt(req.body.budget_alert_id || req.body.budget_alert_history_id, 10);
      if (isNaN(budgetAlertHistoryId)) {
        return this.sendResponse(StatusCode.FAILURE, 'budget_alert_id is required', null as any, 'budget_alert_id is required', res, ResponseStatus.BAD_REQUEST);
      }

      await BudgetControlService.markAlertAsSeen(budgetAlertHistoryId);
      this.sendResponse(StatusCode.SUCCESS, 'Alert marked as seen successfully', null as any, null as any, res, ResponseStatus.SUCCESS);
    } catch (error: any) {
      this.handleError(error.message || 'Error marking alert as seen', res);
    }
  }
}
