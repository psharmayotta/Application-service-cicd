import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import InfraNodesService from '../../services/infraNodes/infraNodesService.services';

export class InfraNodesController extends BaseController {
    constructor(path: APP_ROUTES.INFRANODES, public router = express.Router(), public service: InfraNodesService = new InfraNodesService()) {
        super(path, router, service);
    }
}