import express from "express";
import { BaseController } from "../baseController.controller";
import { APP_ROUTES } from "../../core/AppRoutes";
import validationFDMiddleware from "../../middlewares/validationFormData.middleware";
import { ResponseStatus, StatusCode } from "../../config";
import RefreshTokenService from "../../services/login/refreshTokenService.service";

export class RefreshTokenController extends BaseController {
    constructor(protected path: APP_ROUTES.REFRESHTOKEN, public router = express.Router(), public service: RefreshTokenService = new RefreshTokenService()) {
        super(path, router, service);
    }

    public _initialiseRoutes(): void {
        this.router.post(`${this.path}`, validationFDMiddleware(this.dto, this.service.getMetaModel()), this.refreshToken.bind(this));
    }
    
    protected async refreshToken(req: express.Request, res: express.Response, _next: express.NextFunction) {
        const model = this.service.getModel();
        const msg = 'Login Token Generated Successfully';
        const data: any = this.processData(req, model);
        this.service
            .refreshToken(data)
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, msg, data, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                console.log('catch', err);
                this.handleError(err, res)
            });
    }
}