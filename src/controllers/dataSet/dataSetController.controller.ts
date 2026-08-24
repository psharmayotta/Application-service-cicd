import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import CompanyService from '../../services/company/companyService.services';
import DataSetService from '../../services/dataSet/dataSetService.services';
import { StatusCode, ResponseStatus } from '../../config';
import authMiddleware from '../../middlewares/authMiddleware';

export class DatasetController extends BaseController {
    constructor(path: APP_ROUTES.DATASET, public router = express.Router(), public service: DataSetService = new DataSetService()) {
        super(path, router, service);
    }

    public _initialiseRoutes(): void {
        super._initialiseRoutes();
        this.router.post(`${this.path}/restore`, authMiddleware, this.restoreData.bind(this));
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

    protected async restoreData(req: express.Request, res: express.Response, _next: express.NextFunction) {
        const msg = this.service.getModuleName();
        this.service
            .restoreData(req.body)
            .then((response) => {
                if (response == true) {
                    this.sendResponse(StatusCode.SUCCESS, `${msg} Restored Successfully`, null, null, res, ResponseStatus.SUCCESS);
                } else {
                    this.handleError('Error while restoring Record', res)
                }
            })
            .catch((err) => {
                this.handleError(err, res)
            });
    }
}