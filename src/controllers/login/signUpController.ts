import express from "express";
import { BaseController } from "../baseController.controller";
import { APP_ROUTES } from "../../core/AppRoutes";
import validationFDMiddleware from "../../middlewares/validationFormData.middleware";
import { ResponseStatus, StatusCode } from "../../config";
import SignUpService from "../../services/login/signUpService.service";

export class SignUPController extends BaseController {
    constructor(protected path: APP_ROUTES.SIGNUP, public router = express.Router(), public service: SignUpService = new SignUpService()) {
        super(path, router, service);
    }

    public _initialiseRoutes(): void {
        this.router.post(`${this.path}`, validationFDMiddleware(this.dto, this.service.getMetaModel()), this.signUp.bind(this));
    }

    protected async signUp(req: express.Request, res: express.Response, _next: express.NextFunction) {
        console.log("------------url-----------", req.url);
        const model = this.service.getModel();
        const msg = 'Sign Up Successfully';
        const data: any = this.processData(req, model);
        // this.service
        //     .signUp(data)
        //     .then((data) => {
        //         this.sendResponse(StatusCode.SUCCESS, msg, data, null, res, ResponseStatus.SUCCESS);
        //     })
        //     .catch((err) => {
        //         console.log('catch', err);
        //         this.handleError(err, res)
        //     });
    }
}