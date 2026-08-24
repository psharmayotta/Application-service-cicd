import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import { NotificationService } from '../../services/notification/notificationService.services';
import { ResponseStatus, StatusCode } from '../../config';

export class NotificationController extends BaseController {
    constructor(path: APP_ROUTES.NOTIFICATION, public router = express.Router(), public service: NotificationService = new NotificationService()) {
        super(path, router, service);
    }
    public _initialiseRoutes(): void {
        super._initialiseRoutes();
        this.router.post(`${this.path}/mark-as-read`, this.markAsRead.bind(this));
    }

    protected async markAsRead(req: express.Request, res: express.Response, _next: express.NextFunction) {
        const model = this.service.getModel();
        const msg = this.service.getModuleName();
        const data: any = this.processData(req, model);
        this.service
            .markAsRead(data)
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, msg, data, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                console.log('catch', err);
                this.handleError(err, res)
            });
    }
}
