import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import BillingUsageService from '../../services/monthlyBilling/billingUsageService.services';

export class BillingUsageController extends BaseController {
    constructor(path: APP_ROUTES.BILLING_USAGE, public router = express.Router(), public service: BillingUsageService = new BillingUsageService()) {
        super(path, router, service);
    }
}
