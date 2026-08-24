
import express from "express";
import { BaseController } from "../baseController.controller";
import { APP_ROUTES } from "../../core/AppRoutes";
import validationFDMiddleware from "../../middlewares/validationFormData.middleware";
import { ResponseStatus, StatusCode } from "../../config";
import JoinCompanyService from "../../services/company/joinCompanyService.service";
import authMiddleware from "../../middlewares/authMiddleware";

export class JoinCompanyController extends BaseController {
    constructor(protected path: APP_ROUTES.JOIN_COMPANY, public router = express.Router(), public service: JoinCompanyService = new JoinCompanyService()) {
        super(path, router, service);
    }

    public _initialiseRoutes(): void {
        this.router.post(`${this.path}`, authMiddleware, validationFDMiddleware(this.dto, this.service.getMetaModel()), this.joinCompany.bind(this));
    }

    public async joinCompany(req: express.Request, res: express.Response): Promise<void> {
        const model = this.service.getModel();
        const msg = this.service.getModuleName();
        const data: any = this.processData(req, model);
        this.service
            .createRecord(data, null)
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, msg, data, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                console.log('catch', err);
                this.handleError(err, res)
            });
    }
}
