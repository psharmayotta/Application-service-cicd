import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import ModulesService from '../../services/modules/modulesService.services';
import MyModelService from '../../services/myModel/myModelService.service';
import validationFDMiddleware from '../../middlewares/validationFormData.middleware';
import { StatusCode, ResponseStatus } from '../../config';

export class MyModelController extends BaseController {
    constructor(path: APP_ROUTES.MY_MODEL, public router = express.Router(), public service: MyModelService = new MyModelService()) {
        super(path, router, service);
    }

    public _initialiseRoutes(): void {
        super._initialiseRoutes();
        this.router.post(`${this.path}/update-status`, this.updateStatus.bind(this));
    }

    protected async updateStatus(req: express.Request, res: express.Response, _next: express.NextFunction) {
        const model = this.service.getModel();
        const msg = this.service.getModuleName();
        const data: any = this.processData(req, model);
        this.service
            .updateStatus(data)
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, msg, data, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                console.log('catch', err);
                this.handleError(err, res)
            });
    }
}