import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import CompanyService from '../../services/company/companyService.services';

export class CompanyController extends BaseController {
    constructor(path: APP_ROUTES.COMPANY, public router = express.Router(), public service: CompanyService = new CompanyService()) {
        super(path, router, service);
    }
}