import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import RoleModulePermissionService from '../../services/roleModulePermission/roleModulePermissionService.services';

export class RoleModulePermissionController extends BaseController {
    constructor(path: APP_ROUTES.ROLE_MODULE_PERMISSION, public router = express.Router(), public service: RoleModulePermissionService = new RoleModulePermissionService()) {
        super(path, router, service);
    }
}