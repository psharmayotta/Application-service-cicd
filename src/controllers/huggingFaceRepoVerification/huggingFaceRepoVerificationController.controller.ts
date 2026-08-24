import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import MemberLoginsService from '../../services/memberLogins/memberLoginsService.services';
import validationFDMiddleware from '../../middlewares/validationFormData.middleware';
import authMiddleware from '../../middlewares/authMiddleware';
import { StatusCode, ResponseStatus } from '../../config';
import HuggingFaceRepoVerificationService from '../../services/huggingFaceRepoVerify/huggingFaceRepoVeriFyService.service';

export class HuggingFaceRepoVerificationController extends BaseController {
    constructor(path: APP_ROUTES.HUGGING_FACE_REPO_VERIFICATION, public router = express.Router(), public service: HuggingFaceRepoVerificationService = new HuggingFaceRepoVerificationService()) {
        super(path, router, service);
    }


    public _initialiseRoutes(): void {
        super._initialiseRoutes();
        this.router.post(`${this.path}`, authMiddleware, validationFDMiddleware(this.dto, this.service.getMetaModel()), this.verifyRepo.bind(this));
        this.router.post(`${this.path}/dataset`, authMiddleware, validationFDMiddleware(this.dto, this.service.getMetaModel()), this.verifyDatasetRepo.bind(this));
    }

    protected async verifyRepo(req: express.Request, res: express.Response, _next: express.NextFunction) {
        const model = this.service.getModel();
        const msg = this.service.getModuleName();
        const data: any = this.processData(req, model);
        this.service
            .verifyRepo(data)
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, msg, data, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                console.log('catch', err);
                this.handleError(err, res)
            });
    }

    protected async verifyDatasetRepo(req: express.Request, res: express.Response, _next: express.NextFunction) {
        const model = this.service.getModel();
        const msg = this.service.getModuleName();
        const data: any = this.processData(req, model);
        this.service
            .verifyDatasetRepo(data)
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, msg, data, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                console.log('catch', err);
                this.handleError(err, res)
            });
    }

}

