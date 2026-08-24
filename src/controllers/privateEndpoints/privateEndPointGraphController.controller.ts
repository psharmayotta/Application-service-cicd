import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import { ResponseStatus, StatusCode } from '../../config';
import authMiddleware from '../../middlewares/authMiddleware';
import PrivateEndPointGraphService from '../../services/usage/privateEndpointGraphService.services';

export class PrivateEndPointGraphController extends BaseController {
    constructor(path: APP_ROUTES.PRIVATEENDPOINT, public router = express.Router(), public service: PrivateEndPointGraphService = new PrivateEndPointGraphService()) {
        super(path, router, service);
    }

    public _initialiseRoutes(): void {
        this.router.post(`${this.path}/usage`, authMiddleware, this.getGraph.bind(this));
    }

    public async getGraph(req: express.Request, res: express.Response, _next: express.NextFunction) {
        const param = req.body;
        const msg = 'Private endpoint graph fetched successfully.';
        this.service
            .getGraph(param)
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, msg, data as any, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                this.handleError(err, res);
            });
    }
}
