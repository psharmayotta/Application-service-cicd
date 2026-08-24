import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import CloudProviderServices from '../../services/cloudProvider/cloudProviderService.services';

export class CloudProviderController extends BaseController {
     constructor(path: APP_ROUTES.CLOUDPROVIDER, public router = express.Router(), public service: CloudProviderServices = new CloudProviderServices()) {
        super(path, router, service);
    }
}