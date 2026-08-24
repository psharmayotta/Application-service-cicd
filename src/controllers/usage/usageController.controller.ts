import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import UsageService from '../../services/usage/usageService.services';

export class UsageController extends BaseController {
    constructor(path: APP_ROUTES.USAGE, public router = express.Router(), public service: UsageService = new UsageService()) {
        super(path, router, service);
    }
}