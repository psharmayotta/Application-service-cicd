import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import ClustersService from '../../services/clusters/clustersService.services';

export class ClustersController extends BaseController {
    constructor(path: APP_ROUTES.CLUSTERS, public router = express.Router(), public service: ClustersService = new ClustersService()) {
        super(path, router, service);
    }
}