import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import HardwareUtilizationService from '../../services/hardwareUtilization/hardwareUtilizationService.service';

export class HardwareUtilizationController extends BaseController {
    constructor(path: APP_ROUTES.HARDWAREUTILIZATION, public router = express.Router(), public service: HardwareUtilizationService = new HardwareUtilizationService()) {
        super(path, router, service);
    }
}