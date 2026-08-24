import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import GpuCostService from '../../services/gpuCost/gpuCostService.services';
import authMiddleware from '../../middlewares/authMiddleware';
import { ResponseStatus, StatusCode } from '../../config';

export class GpuCostController extends BaseController {
    constructor(path: APP_ROUTES, public router = express.Router(), public service: GpuCostService = new GpuCostService()) {
        super(path, router, service);
    }

    override _initialiseRoutes(): void {
        super._initialiseRoutes();
        this.router.post(`${this.path}/get-cost`, authMiddleware, this.getGpuCost.bind(this));
    }

    private async getGpuCost(req: express.Request, res: express.Response, _next: express.NextFunction) {
        try {
            const companyId = parseInt(req.body.company_id);
            if (!req.body.company_id || isNaN(companyId)) {
                return this.handleError('E10020', res);
            }
            const data = await (this.service as GpuCostService).getMinMaxGpuCost(companyId);
            this.sendResponse(StatusCode.SUCCESS, 'GPU cost fetched successfully', data as any, null as any, res, ResponseStatus.SUCCESS);
        } catch (error: any) {
            this.handleError(error.message || 'E10005', res);
        }
    }
}
