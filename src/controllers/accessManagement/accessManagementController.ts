import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import AccessManagementService from '../../services/accessManagement/accessManagementService.service';

export class AccessManagementController extends BaseController {
    constructor(path: APP_ROUTES.ACCESS_MANAGEMENT, public router = express.Router(), public service: AccessManagementService = new AccessManagementService()) {
        super(path, router, service);
    }
}