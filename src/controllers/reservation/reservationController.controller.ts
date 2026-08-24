import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import ReservationService from '../../reservation/reservationService.services';

export class ReservationController extends BaseController {
    constructor(path: APP_ROUTES.RESERVATION, public router = express.Router(), public service: ReservationService = new ReservationService()) {
        super(path, router, service);
    }
}   