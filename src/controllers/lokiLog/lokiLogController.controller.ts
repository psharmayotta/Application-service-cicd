import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import { ResponseStatus, StatusCode } from '../../config';
import { LokiLogService } from '../../services/lokiLog/lokiLogService.service';
import { LokiLogModel } from '../../database/repository/lokiLog/lokiLog.model';
import authMiddleware from '../../middlewares/authMiddleware';

export class LokiLogController extends BaseController {
    constructor(path: APP_ROUTES = APP_ROUTES.LOKI_LOGS, public router = express.Router(), public service: LokiLogService = new LokiLogService()) {
        super(path, router, service);
    }

    public _initialiseRoutes(): void {
        this.router.post(`${this.path}/get-logs`, authMiddleware, this.getLogs.bind(this));
    }

    public async getLogs(req: express.Request, res: express.Response, _next: express.NextFunction) {
        const model = this.service.getModel();
        const msg = this.service.getModuleName();
        const data: any = this.processData(req, model);
        this.service
            .getExactLogs(data)
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, msg, data as any, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                console.log('catch', err);
                this.handleError(err, res)
            });
    }
}
