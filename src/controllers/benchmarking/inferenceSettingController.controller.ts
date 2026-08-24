import express from "express";
import { APP_ROUTES } from "../../core/AppRoutes";
import { InferenceSettingService } from "../../services/benchmarking/inferenceSettingService.services";
import { BaseController } from "../baseController.controller";
import authMiddleware from "../../middlewares/authMiddleware";
import { StatusCode, ResponseStatus } from "../../config";

export class InferenceSettingController extends BaseController {
    constructor(protected path: APP_ROUTES.INFERENCE_SETTING, public router = express.Router(), public service: InferenceSettingService = new InferenceSettingService()) {
        super(path, router, service);
        this._initialiseRoutesForInference();
    }

    private _initialiseRoutesForInference() {
        this.router.post(`${this.path}/get`, authMiddleware, this.getInferenceSettings.bind(this));
    }

    private async getInferenceSettings(req: express.Request, res: express.Response, _next: express.NextFunction) {
        console.log("------------url-----------", req.url);
        const msg = this.handleSuccessMessage('GET', req);
        try {
            const data = await this.service.getInferenceSettingsByModel(req.body);
            this.sendResponse(StatusCode.SUCCESS, msg, data as any, null as any, res, ResponseStatus.SUCCESS);
        } catch (err) {
            this.handleError(err, res);
        }
    }
}
