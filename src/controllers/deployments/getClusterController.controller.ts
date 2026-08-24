import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import GetClusterService from '../../services/deployments/getClusterService.services';

export class GetClustersController extends BaseController {
    constructor(path: APP_ROUTES.GETCLUSTERS, public router = express.Router(), public service: GetClusterService = new GetClusterService()) {
        super(path, router, service);
    }
}