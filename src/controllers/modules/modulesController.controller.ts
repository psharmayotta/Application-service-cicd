import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import ModulesService from '../../services/modules/modulesService.services';

export class ModulesController extends BaseController {
    constructor(path: APP_ROUTES.MODULES, public router = express.Router(), public service: ModulesService = new ModulesService()) {
        super(path, router, service);
    }
}