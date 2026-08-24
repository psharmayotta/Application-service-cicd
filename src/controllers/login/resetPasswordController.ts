import express from "express";
import { BaseController } from "../baseController.controller";
import { APP_ROUTES } from "../../core/AppRoutes";
import validationFDMiddleware from "../../middlewares/validationFormData.middleware";
import { ResponseStatus, StatusCode } from "../../config";
import ResetPasswordService from "../../services/login/resetPasswordService.service";

export class ResetPasswordController extends BaseController {
    constructor(protected path: APP_ROUTES.RESETPASSWORD, public router = express.Router(), public service: ResetPasswordService = new ResetPasswordService()) {
        super(path, router, service);
    }

    public _initialiseRoutes(): void {
        this.router.post(`${this.path}`, validationFDMiddleware(this.dto, this.service.getMetaModel()), this.resetPassword.bind(this));
    }

    public async resetPassword(req: express.Request, res: express.Response): Promise<void> {
        const model = this.service.getModel();
        const msg = this.service.getModuleName();
        const data: any = this.processData(req, model);
        this.service
            .resetPassword(data)
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, msg, data, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                console.log('catch', err);
                this.handleError(err, res)
            });
    }
}