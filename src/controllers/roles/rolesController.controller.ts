import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import RolesService from '../../services/roles/rolesService.services';

export class RolesController extends BaseController {
    constructor(path: APP_ROUTES.ROLES, public router = express.Router(), public service: RolesService = new RolesService()) {
        super(path, router, service);
    }
}