import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import AllocationService from '../../services/allocation/allocationService.service';
import PodDetailsService from '../../services/podDetails/podDetailsService.service';

export class PodDetailsController extends BaseController {
    constructor(path: APP_ROUTES.PODDETAILS, public router = express.Router(), public service: PodDetailsService = new PodDetailsService()) {
        super(path, router, service);
    }
}