import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import LogoutService from '../../services/login/logoutService.sevice';
import authMiddleware from '../../middlewares/authMiddleware';
import validationFDMiddleware from '../../middlewares/validationFormData.middleware';
import { StatusCode, ResponseStatus } from '../../config';

export class LogoutController extends BaseController {
    constructor(path: APP_ROUTES.LOGOUT, public router = express.Router(), public service: LogoutService = new LogoutService()) {
        super(path, router, service);
    }

    public _initialiseRoutes(): void {
        this.router.post(`${this.path}`, authMiddleware, validationFDMiddleware(this.dto, this.service.getMetaModel()), this.logout.bind(this));
    }

    protected async logout(req: express.Request, res: express.Response, _next: express.NextFunction) {
        console.log("------------url-----------", req.url);
        const model = this.service.getModel();
        const msg = 'Logout Successfully';
        const data: any = this.processData(req, model);
        this.service
            .logout(data)
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, msg, data, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                console.log('catch', err);
                this.handleError(err, res)
            });
    }
}