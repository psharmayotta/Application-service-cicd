import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import CloudService from '../../services/cloudServices/cloudService.services';

export class CloudServiceController extends BaseController {
    constructor(path: APP_ROUTES.CLOUDSERVICE, public router = express.Router(), public service: CloudService = new CloudService()) {
        super(path, router, service);
    }
}