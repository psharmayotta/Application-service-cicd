import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import CloudAccountService from '../../services/cloudAccount/cloudAccountService.services';
import { CloudFilter } from '../../core/InferParams';

export class CloudAccountController extends BaseController {
    constructor(path: APP_ROUTES.CLOUDACCOUNT, public router = express.Router(), public service: CloudAccountService = new CloudAccountService()) {
        super(path, router, service);
    }

    override prepareQueryParams(param: CloudFilter, req: express.Request) {
        param.pageNumber = req.body.pageNumber ?? 0
        param.pageSize = req.body.pageSize ?? 10
        param.company_id = req.body.company_id
        param.filter.search = (req.body.search ?? '').trim()
        param.module_name = req.body?.module_name ?? ''
        return param;
    }
}