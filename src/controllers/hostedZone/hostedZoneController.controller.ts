import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import HostedZoneService from '../../services/hostedZone/hostedZoneService.services';
import { CloudFilter } from '../../core/InferParams';

export class HostedZoneController extends BaseController {
    constructor(path: APP_ROUTES.HOSTEDZONE, public router = express.Router(), public service: HostedZoneService = new HostedZoneService()) {
        super(path, router, service);
    }

    override prepareQueryParams(param: CloudFilter, req: express.Request) {
        param.pageNumber = req.body.pageNumber ?? 0
        param.pageSize = req.body.pageSize ?? 10
        param.company_id = req.body.company_id
        param.filter.search = (req.body.search ?? '').trim()
        param.cloud_account_id = req.body.cloud_account_id ?? null
        return param;
    }
}