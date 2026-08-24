import { BaseController } from "../baseController.controller";
import { APP_ROUTES } from "../../core/AppRoutes";
import { DashboardService } from "../../services/dashboard/dashboardService.services";
import express from 'express';

export class DashboardController extends BaseController {
    constructor(path: APP_ROUTES.DASHBOARD, public router = express.Router(), public service: DashboardService = new DashboardService()) {
        super(path, router, service);
    }
}
