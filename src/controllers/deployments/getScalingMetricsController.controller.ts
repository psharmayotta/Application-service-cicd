import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import GetScalingMetricService from '../../services/deployments/getScalingMetricsService.services';

export class GetScalingMetricController extends BaseController {
    constructor(path: APP_ROUTES.GETSCALINGMETRICS, public router = express.Router(), public service: GetScalingMetricService = new GetScalingMetricService()) {
        super(path, router, service);
    }
}