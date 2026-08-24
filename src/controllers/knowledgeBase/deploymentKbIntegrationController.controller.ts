import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import DeploymentKbIntegrationService from '../../services/knowledgeBase/deploymentKbIntegrationService.services';
import validationFDMiddleware from '../../middlewares/validationFormData.middleware';
import authMiddleware from '../../middlewares/authMiddleware';
import { DeintegrateDto } from '../../database/repository/deploymentKbIntegration/deploymentKbIntegration.dto';
import { StatusCode, ResponseStatus } from '../../config';

export class DeploymentKbIntegrationController extends BaseController {
    constructor(path: APP_ROUTES.KNOWLEDGE_BASE_DEPLOYMENT_INTEGRATION, public router = express.Router(), public service: DeploymentKbIntegrationService = new DeploymentKbIntegrationService()) {
        super(path, router, service);
    }

    public _initialiseRoutes(): void {
        super._initialiseRoutes();
        this.router.post(`${this.path}/deintegrate`, authMiddleware, validationFDMiddleware(DeintegrateDto, this.service.getMetaModel()), this.deintegrate.bind(this));
    }

    public async deintegrate(req: express.Request, res: express.Response) {
        try {
            const model = this.service.getModel();
            const data: any = this.processData(req, model);
            const result = await this.service.deintegrate(data.id);
            const msg = "Deintegrated Successfully";
            this.sendResponse(StatusCode.SUCCESS, msg, result, null, res, ResponseStatus.SUCCESS);
        } catch (error) {
            this.handleError(error, res);
        }
    }
}
