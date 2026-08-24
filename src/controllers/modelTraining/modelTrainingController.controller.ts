import express from "express";
import { BaseController } from "../baseController.controller";
import { APP_ROUTES } from "../../core/AppRoutes";
import ModelClassService from "../../services/modelClass/modelClassService.services";
import ModelTrainingService from "../../services/modelTraining/modelTrainingService.services";
import { StatusCode, ResponseStatus } from "../../config";

export class ModelTrainingController extends BaseController {
    constructor(protected path: APP_ROUTES.MODELTRAINING, public router = express.Router(), public service: ModelTrainingService = new ModelTrainingService()) {
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