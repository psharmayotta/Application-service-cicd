import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import { DeploymentKbListingService } from '../../services/knowledgeBase/deploymentKbListingService.services';

export class DeploymentKbListingController extends BaseController {
    constructor(path: APP_ROUTES.KNOWLEDGE_BASE_DEPLOYMENTS, public router = express.Router(), public service: DeploymentKbListingService = new DeploymentKbListingService()) {
        super(path, router, service);
    }
}
