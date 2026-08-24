import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import ModelClassService from '../../services/model/modelService.services';

export class ModelController extends BaseController {
    constructor(protected path: APP_ROUTES.MODEL, public router = express.Router(), public service: ModelClassService = new ModelClassService) {
        super(path, router, service);
    } 
}
