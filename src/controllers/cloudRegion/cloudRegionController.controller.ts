import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import CloudRegionService from '../../services/cloudRegion/cloudRegionService.services';

export class CloudRegionController extends BaseController {
     constructor(path: APP_ROUTES.CLOUDREGION, public router = express.Router(), public service: CloudRegionService = new CloudRegionService()) {
        super(path, router, service);
    }
}