import express from "express";
import { BaseController } from "../baseController.controller";
import { APP_ROUTES } from "../../core/AppRoutes";
import validationFDMiddleware from "../../middlewares/validationFormData.middleware";
import { ResponseStatus, StatusCode } from "../../config";
import UpdatePasswordService from "../../services/login/updatePasswordService.service";
import authMiddleware from "../../middlewares/authMiddleware";

export class UpdatePasswordController extends BaseController {
    constructor(protected path: APP_ROUTES.UPDATEPASSWORD, public router = express.Router(), public service: UpdatePasswordService = new UpdatePasswordService()) {
        super(path, router, service);
    }

    public _initialiseRoutes(): void {
        this.router.post(`${this.path}`, authMiddleware, validationFDMiddleware(this.dto, this.service.getMetaModel()), this.updatePassword.bind(this));
    }

    public async updatePassword(req: express.Request, res: express.Response, _next: express.NextFunction): Promise<void> {
        const model = this.service.getModel();
        const msg = this.service.getModuleName();
        const data: any = this.processData(req, model);
        this.service
            .updatePassword(data)
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, msg, data, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                console.log('catch', err);
                this.handleError(err, res)
            });
    }
}
