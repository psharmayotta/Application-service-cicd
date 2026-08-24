import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import TimezoneService from '../../services/timezone/timezoneService.services';

export class TimezoneController extends BaseController {
    constructor(path: APP_ROUTES.TIMEZONE, public router = express.Router(), public service: TimezoneService = new TimezoneService()) {
        super(path, router, service);
    }
}