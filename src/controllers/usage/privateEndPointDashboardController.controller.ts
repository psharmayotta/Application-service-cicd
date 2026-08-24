import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import PrivateEndPointModelService from '../../services/usage/privateEndpointModelService.services';
import PrivateEndPointDashboardService from '../../services/usage/privateEndpointDashboardService.services';

export class PrivateEndPointDashboardController extends BaseController {
    constructor(path: APP_ROUTES.PRIVATEENDPOINT, public router = express.Router(), public service: PrivateEndPointDashboardService = new PrivateEndPointDashboardService()) {
        super(path, router, service);
    }
}