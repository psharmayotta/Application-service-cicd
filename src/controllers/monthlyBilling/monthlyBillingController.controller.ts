import { BaseController } from "../baseController.controller";
import { APP_ROUTES } from "../../core/AppRoutes";
import { MonthlyBillingService } from "../../services/monthlyBilling/monthlyBillingService.services";
import express from 'express';

export class MonthlyBillingController extends BaseController {
    constructor(path: APP_ROUTES = APP_ROUTES.MONTHLY_BILLING, public router = express.Router(), public service: MonthlyBillingService = new MonthlyBillingService()) {
        super(path, router, service);
    }
}
