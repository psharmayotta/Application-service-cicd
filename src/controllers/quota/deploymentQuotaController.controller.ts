import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import DeploymentQuotaService from '../../services/quota/deploymentQuotaService.service';

export class DeploymentQuotaController extends BaseController {
    constructor(path: APP_ROUTES.DEPLOYMENTQUOTA, public router = express.Router(), public service: DeploymentQuotaService = new DeploymentQuotaService()) {
        super(path, router, service);
    }
}   