import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import GetCloudSecretService from '../../services/cloudAccount/getCloudSecretService.services';

export class GetCloudSecretController extends BaseController {
    constructor(path: APP_ROUTES.GETSECRETALONGCLOUD, public router = express.Router(), public service: GetCloudSecretService = new GetCloudSecretService()) {
        super(path, router, service);
    }
}