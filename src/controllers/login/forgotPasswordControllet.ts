import express from "express";
import { BaseController } from "../baseController.controller";
import { APP_ROUTES } from "../../core/AppRoutes";
import validationFDMiddleware from "../../middlewares/validationFormData.middleware";
import { ResponseStatus, StatusCode } from "../../config";
import ForgotPasswordService from "../../services/login/forgotPasswordService.service";

export class ForgotPasswordController extends BaseController {
    constructor(protected path: APP_ROUTES.FORGOTPASSWORD, public router = express.Router(), public service: ForgotPasswordService = new ForgotPasswordService()) {
        super(path, router, service);
    }

    public _initialiseRoutes(): void {
        this.router.post(`${this.path}`, validationFDMiddleware(this.dto, this.service.getMetaModel()), this.forgotPassword.bind(this));
    }

    protected async forgotPassword(req: express.Request, res: express.Response, _next: express.NextFunction) {
        const model = this.service.getModel();
        const msg = this.service.getModuleName();
        const data: any = this.processData(req, model);
        this.service
            .forgotPassword(data)
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, msg, data, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                console.log('catch', err);
                this.handleError(err, res)
            });
    }
}