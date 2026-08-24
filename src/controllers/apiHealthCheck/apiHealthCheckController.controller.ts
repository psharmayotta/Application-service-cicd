import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import { ResponseStatus, StatusCode } from '../../config';
import APIHealthCheckService from '../../services/apiHealthCheck/apiHealthCheckService.services';

export class APIHealthCheckController extends BaseController {
    constructor(path: APP_ROUTES.APIHEALTHCHECK, public router = express.Router(), public service: APIHealthCheckService = new APIHealthCheckService()) {
        super(path, router, service);
    }

    public _initialiseRoutes(): void {
        this.router.get(`${this.path}/apihealth`, this.APIHealthCheck.bind(this));
    }

    public APIHealthCheck(req: express.Request, res: express.Response, _next: express.NextFunction) {
        const message = `API Server is up and running successfully!`
        this.service.apiHealthCheck()
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, message, data, null, res, ResponseStatus.SUCCESS);
            })
            .catch((error) => {
                this.handleError(error, res)
            })

    };

}