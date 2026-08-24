import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import CloudSecretsService from '../../services/cloudSecrets/cloudSecretsService.service';
import { Pagination } from '../../core/InferParams';

export class CloudSecretsController extends BaseController {
    constructor(path: APP_ROUTES.CLOUD_SECRETS, public router = express.Router(), public service: CloudSecretsService = new CloudSecretsService()) {
        super(path, router, service);
    }

    override prepareQueryParams(param: Pagination, req: express.Request) {
        param.pageNumber = req.body.pageNumber ?? 0
        param.pageSize = req.body.pageSize ?? 10
        param.company_id = req.body.company_id
        param.filter.search = req.body.search ? req.body.search.trim() : (req.body.filter?.search ? req.body.filter.search.trim() : '')
        param.filter.secret_type = req.body.secret_type ?? req.body.filter?.secret_type ?? null
        param.filter.usage_status = req.body.usage_status ?? req.body.filter?.usage_status ?? null
        return param;
    }
}
