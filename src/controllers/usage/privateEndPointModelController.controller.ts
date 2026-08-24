import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import PrivateEndPointModelService from '../../services/usage/privateEndpointModelService.services';

export class PrivateEndPointModelController extends BaseController {
    constructor(path: APP_ROUTES.PRIVATEMODEL, public router = express.Router(), public service: PrivateEndPointModelService = new PrivateEndPointModelService()) {
        super(path, router, service);
    }
}