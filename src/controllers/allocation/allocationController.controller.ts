import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import AllocationService from '../../services/allocation/allocationService.service';

export class AllocationController extends BaseController {
    constructor(path: APP_ROUTES.ALLOCATION, public router = express.Router(), public service: AllocationService = new AllocationService()) {
        super(path, router, service);
    }
}