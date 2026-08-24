import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import RbacRolesService from '../../services/rbacRoles/rbacRolesService.services';

export class RbacRolesController extends BaseController {
    constructor(path: APP_ROUTES.RBAC_ROLES, public router = express.Router(), public service: RbacRolesService = new RbacRolesService()) {
        super(path, router, service);
    }
}
