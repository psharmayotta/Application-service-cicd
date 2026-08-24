import express from "express";
import { BaseController } from "../baseController.controller";
import { APP_ROUTES } from "../../core/AppRoutes";
import { ResponseStatus, StatusCode } from "../../config";
import YottaOneIntegrationService from "../../services/yottaOneIntegration/yottaOneIntegrationService.services";
import { MembersEntity } from "../../entities/membersEntity";
import { MemberLoginsEntity } from "../../entities/memberLoginsEntity";
import * as bcrypt from "bcryptjs";
import { createjwt } from "../../utils/jwt/jwt";
import authMiddleware from "../../middlewares/authMiddleware";
export class RegisterationController extends BaseController {

    constructor(protected path: APP_ROUTES, public router = express.Router(), public service: YottaOneIntegrationService = new YottaOneIntegrationService()) {
        super(path, router, service);
    }

    public _initialiseRoutes(): void {
        this.router.post(`/pub/api/v1/generate-token`, this.generateToken.bind(this));
        this.router.post(`/pub/api/v1/sync-ext-customer`, authMiddleware, this.syncExtCustomer.bind(this));
        this.router.post(`/pub/api/v1/get-ext-customer`, authMiddleware, this.getExtCustomer.bind(this));
    }

    protected async generateToken(req: express.Request, res: express.Response, _next: express.NextFunction) {
        const model = this.service.getModel();
        const msg = this.service.getModuleName();
        const data: any = this.processData(req, model);
        this.service
            .generateToken(data)
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, `Token generated successfully`, data as any, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                console.log('catch', err);
                this.handleError(err, res);
            });
    }

    protected async syncExtCustomer(req: express.Request, res: express.Response, _next: express.NextFunction) {
        const model = this.service.getModel();
        const msg = this.service.getModuleName();
        const data: any = this.processData(req, model);
        this.service
            .syncExtCustomer(data)
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, `${msg} sync successful`, data, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                console.log('catch', err);
                this.handleError(err, res);
            });
    }

    protected async getExtCustomer(req: express.Request, res: express.Response, _next: express.NextFunction) {
        const model = this.service.getModel();
        const msg = this.service.getModuleName();
        const data: any = this.processData(req, model);
        this.service
            .getExtCustomer(data)
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, `${msg} customer found`, data, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                console.log('catch', err);
                this.handleError(err, res);
            });
    }
}
