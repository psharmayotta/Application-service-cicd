import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import DeploymentModelService from '../../services/deployments/deploymentModelService.service';

export class DeploymentModelController extends BaseController {
    constructor(protected path: APP_ROUTES.DEPLOYMENTMODEL, public router = express.Router(), public service: DeploymentModelService = new DeploymentModelService()) {
        super(path, router, service);
    }
}
